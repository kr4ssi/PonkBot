/*!
**|   PonkBot Custom Functions
**@
*/

'use strict';

const parseLink = require('./parselink.js')
const request = require('request')
const URL = require('url')
const PATH = require('path')
const validUrl = require('valid-url')

const { getVideoDurationInSeconds } = require('get-video-duration')
const youtubedl = require('@microlink/youtube-dl')

const Gitlab = require('gitlab/dist/es5').default
const gitclient = new Gitlab({
  token: process.env.api_gitlab
})
const gitrepo = process.env.gitrepo

let count = 0
const waiting = []
let lastImages = []

module.exports = {
  checkMessageTrigger: function(user, message) {
    if (![
      this.name,
      '[server]',
      'Kommandant'
    ].includes(user)) {
      let match
      let regex = /(?<=^|\s)(\/[a-zA-Z0-9ßäöüÄÖÜ]+)(?=\s|$)/g
      while (match = regex.exec(message)) {
        let emote = this.emotes.find(emote => emote.name == match[1])
        if (!emote) continue
        emote = emote.name
        this.db.knex('emotescount').insert({ emote, count: 1 , user}).catch(() => {
          return this.db.knex('emotescount').where({ emote }).increment('count').update({ user })
        }).then(() => {
          //this.logger.log('Emote used: ' + emote)
        })
      }
      regex = /<img class="image-embed-small" src="(https?:\/\/[^"]+)" \/>/g
      while (match = regex.exec(message)) {
        this.addLastImage(match[1])
      }
      if (message.match(new RegExp('^' + this.name + '|[^!.$/]' + this.name))) {
        const quotes = [
          'Hiiiiiiii',
          'jaaaah?',
          'ja morgen',
          'w-was?',
          'lass mich',
          'hihi',
          'iiich?'
        ]
        if (user === 'melli17') this.sendMessage('/knuddeln')
        else this.sendMessage(quotes[Math.floor(Math.random() * quotes.length)])
      }
    }
  },
  pushToGit: function(filename, content, encoding) {
    if (count > 0) return waiting.push(arguments)
    count++
    const gitObj = { commit_message: 'updated', content }
    if (encoding) gitObj.encoding = encoding
    const gitArr = [gitrepo, filename, 'master', gitObj]
    gitclient.RepositoryFiles.edit(...gitArr).then(result => {
      console.log(result)
      count--
      if (waiting.length) pushToGit(...waiting.shift())
    }).catch(err => {
      if (err.statusCode == 400 && err.error.message === 'A file with this name doesn\'t exist') {
        gitObj.commit_message = 'created'
        gitclient.RepositoryFiles.create(...gitArr).then(result => {
          console.log(result)
          count--
          if (waiting.length) pushToGit(...waiting.shift())
        }).catch(err => {
          console.log(err)
        })
      }
      else console.log(err)
    })
  },
  addLastImage: function(image) {
    return new Promise((resolve, reject) => {
      if (image === lastImages[0]) return resolve(image)
      lastImages.unshift(image)
      this.db.knex('lastimage').insert({ image }).then(() => {
        //this.logger.log('Image posted: ' + image)
        resolve(image)
      }, error => {
        this.logger.error('Unexpected error', '\n', error);
        resolve(image)
      })
    })
  },
  getLastImage: function(back) {
    console.log(lastImages)
    if (!back) back = 0
    return new Promise(resolve => {
      if (lastImages.length > back + 1) return resolve(lastImages[back])
      this.db.knex('lastimage')
      .select('image').limit(back + 1).orderBy('id', 'desc').then(result => {
        if (result.length > back) {
          lastImages = result.map(row => row.image)
          resolve(lastImages[back])
        }
      }, err => resolve(this.sendMessage('fehler')))
    })
  },
  rehostUrl: function(url, host = this.API.keys.imagehost) {
    return new Promise((resolve, reject) => {
      request({
        url,
        encoding: null
      }, (err, res, body) => {
        if (err || res.statusCode !== 200) return reject(err, 'download failed')
        const contentType = res.headers['content-type'] || 'image/jpeg'
        let ext = contentType.split('/').pop()
        if (ext === 'jpeg') ext = 'jpg'
        request.post({
          url: host,
          formData: {
            file: {
              value: body,
              options: {
                filename: 'image.' + ext,
                contentType
              }
            },
            format: 'json'
          },
          json: true
        }, (err, res, body) => {
          if (err || res.statusCode !== 200) return reject(err, 'upload failed')
          if (!body.msg || !body.msg.short) return reject(body, 'parsing error')
          const image = host + body.msg.short
          this.addLastImage(image).then(image => {
            resolve(image)
          })
        })
      })
    })
  },
  sendByFilter: function(message, force) {
    if (message.length < 320 && !force) return this.sendMessage(message)
    const limit = 1000
    const count = Math.ceil(message.length / limit)
    for (let i = 0; i < count; i++) {
      const filterstring = '###' + Math.random().toString(36).slice(2) + '###'
      this.client.socket.emit('updateFilter', {
        name: 'Bot filter',
        source: filterstring,
        replace: message.substr(i * limit, limit),
        flags: '',
        active: true
      })
      this.sendMessage(filterstring)
      this.client.socket.emit('updateFilter', {
        name: 'Bot filter',
        source: '',
        replace: '',
        flags: ''
      })
    }
  },
  pollAction: function(poll, callback) {
    if(!this.meeseeks('pollctl')){
      return this.sendPrivate(`I lack this capability due to channel permission settings.`, user)
    }
    this.client.createPoll(poll)
    this.client.once('newPoll', () => {
      let timeout = false
      if (poll.timeout && poll.timeout > 10) {
        timeout = setTimeout(() => {
          this.sendMessage('Noch 10 Sekunden Zeit abzustimmen.', { ignoremute: true })
        }, (poll.timeout - 10) * 1000)
      }
      this.client.once('closePoll', () => {
        timeout && clearTimeout(timeout)
        if (callback && typeof(callback) === 'function') {
          callback(this.pollvotes)
        }
      })
    })
  },
  addNetzm: function(id, willkür, user, type = 'fi', title, url) {
    let pos = 'end'
    if (this.getUserRank(user) < 3 ) {
      if (this.chanopts.playlist_max_per_user && this.playlist.filter(item => item.queueby == user).length > this.chanopts.playlist_max_per_user) {
        return this.sendMessage('Addierlimit erreicht')
      }
    }
    else if (willkür) pos = 'next'
    this.mediaSend({ type, id, pos, title })
  },
  add: function(user, params, meta, fiku) {
    if (typeof meta != 'object') fiku = meta
    if (this.getUserRank(user) > 0 ) {
      const cleanparams = params.replace(/willkür$/, '').trim()
      const split = cleanparams.split(' ')
      let url = split.shift()
      let title = split.join(' ').trim()
      url = validUrl.isHttpsUri(url)
      if (url) {
        const urlbak = url
        url = url.replace(/https?:\/\/o(pen)?load\..*\/(f|embed)\//, 'https://openload.co/f/')
        url = url.replace(/https?:\/\/(streamango\.com|fruithosts\.net)\/(f|embed)\//, 'https://streamango.com/f/')
        const allowedHosts = [
          'liveleak.com',
          'imgur.com',
          'instagram.com',
          'ndr.de',
          'arte.tv',
          'bandcamp.com',
          'mixcloud.com',
          'archive.org',
          'ccc.de',
          'bitchute.com'
        ]
        const needManifest = [
          'twitter.com',
          'daserste.de',
          'zdf.de',
          'wdr.de',
          'mdr.de',
          'br.de',
          'bild.de',
          'watchbox.de',
          //'kinoger.to',
          'nxload.com'
        ]
        const needUserScript = [
          'openload.co',
          'streamango.com'
        ]
        const manifest = {
          title,
          live: false,
          duration: 0,
          sources: [
            {
              url,
              quality: 720,
              contentType: 'application/x-mpegURL'
            }
          ]
        }
        const sendJson = (manifest, cache) => {
          if (!cache) this.cmManifests[url] = {
            manifest,
            //timestamp,
            user: {}
          }
          if (needUserScript.some(allowed => new RegExp('^https?:\\/\\/([-\\w]+\\.)*' + allowed + '\\/.+', 'i').test(url))) {
            manifest.sources[0].url = this.server.weblink + '/redir?url=' + url
            this.client.createPoll({
              title,
              opts: ['Geht nur mit Userscript', this.server.weblink + '/ks.user.js (update vom 8.4.19)', 'dann ' + urlbak + ' öffnen', 'Ok klicken und falls es schon läuft player neu laden'],
              obscured: false
            })
          }
          request(this.server.weblink + '/add.json?url=' + url, (err, res, body) => {
            if (err || res.statusCode != 200) return console.error(err || body)
            console.log(body)
            this.addNetzm(this.server.weblink + '/add.json?url=' + url, (params != cleanparams), user, 'cm', manifest.title)
          })
        }
        const getDuration = (manifest, video) => {
          return new Promise((resolve, reject) => {
            if (manifest.live || manifest.duration) return resolve(manifest)
            let tries = 0
            const tryToGetDuration = err => {
              if (err) console.error(err)
              if (tries > 1) {
                if (video) video.destroy()
                return reject(tries)
              }
              tries++
              getVideoDurationInSeconds(video || manifest.sources[0].url).then(duration => {
                Object.assign(manifest, {duration})
                resolve(manifest)
                if (video) video.destroy()
                console.log('got duration: ' + duration)
              }, tryToGetDuration)
            }
            tryToGetDuration()
          })
        }
        const getDurationAndSend = manifest => getDuration(manifest).then(sendJson, err => this.sendMessage(err.message))
        if (url.match(/https?:\/\/(?:www\.)?nxload\.com\/(?:embed-)?(\w+)/i)) {
          request(url.replace(/embed-/i, ''), (err, res, body) => {
            if (err) {
              this.sendMessage(err.message)
              console.error(err)
              return
            }
            if (res.statusCode != 200) {
              this.sendMessage('Status:' + res.statusCode)
              console.error(body)
              return
            }
            const regMatch = body.match(/master\.m3u8","([^"]+)/i)
            if (!regMatch) {
              this.sendMessage('Fehler')
              console.error(body)
              return
            }
            const titleMatch = body.match(/<title>Watch ([^<]+)/i)
            if (!title && titleMatch) title = titleMatch[1]
            this.addNetzm(regMatch[1].replace(/^http:\/\//i, 'https://'), (params != cleanparams), user, 'fi', title)
          })
        }
        else if (/.*\.m3u8$/.test(url)) getDurationAndSend(manifest)
        else if (allowedHosts.some(allowed => new RegExp('^https?:\\/\\/([-\\w]+\\.)*' + allowed + '\\/.+', 'i').test(url))) {
          youtubedl.getInfo(url, ['-U', '--restrict-filenames'], (err, info) => {
            if (err) {
              console.error(err)
              this.sendMessage(err.message.split('\n').filter(line => /^ERROR: /.test(line)).join('\n'))
              return
            }
            if (!info.title) info = info[0];
            title = title || (info.extractor_key + ' - ' + info.title.replace(new RegExp('^' + info.extractor_key, 'i')))
            this.addNetzm(info.url.replace(/^http:\/\//i, 'https://'), (params != cleanparams), user, 'fi', title, url)
          })
        }
        else if ([...needManifest, ...needUserScript].some(allowed => new RegExp('^https?:\\/\\/([-\\w]+\\.)*' + allowed + '\\/.+', 'i').test(url))) {
          const getInfo = (url, manifest) => {
            return new Promise((resolve, reject) => {
              const video = youtubedl(url, ['-U', '--restrict-filenames']).on('error', reject).on('info', info => {
                if (!info.title) info = info[0]
                const contentType = ext => {
                  const contentType = [
                    {type: 'video/mp4', ext: ['.mp4']},
                    {type: 'video/webm', ext: ['.webm']},
                    {type: 'application/x-mpegURL', ext: ['.m3u8']},
                    {type: 'video/ogg', ext: ['.ogv']},
                    {type: 'application/dash+xml', ext: ['.mpd']},
                    {type: 'audio/aac', ext: ['.aac']},
                    {type: 'audio/ogg', ext: ['.ogg']},
                    {type: 'audio/mpeg', ext: ['.mp3', '.m4a']}
                  ].find(contentType => contentType.ext.includes(ext)) || {}
                  return contentType.type
                }
                manifest.title = manifest.title || info.extractor_key + ' - ' + info.title.replace(new RegExp('^' + info.extractor_key, 'i'))
                if (info.manifest_url) manifest.sources[0].url = info.manifest_url.replace(/^http:\/\//i, 'https://')
                else {
                  manifest.sources[0].url = info.url.replace(/^http:\/\//i, 'https://')
                  manifest.sources[0].contentType = contentType(PATH.extname(URL.parse(info.url).pathname)) || 'video/mp4'
                }
                if ([240, 360, 480, 540, 720, 1080, 1440].includes(info.width)) manifest.sources[0].quality = info.width;
                if (info.thumbnail && info.thumbnail.match(/^https?:\/\//i)) manifest.thumbnail = info.thumbnail.replace(/^http:\/\//i, 'https://')
                console.log(manifest)
                if (!info._duration_raw) return getDuration(manifest, video).then(resolve, reject)
                manifest.duration = info._duration_raw
                resolve(manifest)
                video.destroy()
              })
            })
          }
          getInfo(url, manifest).then(getDurationAndSend, err => {
            console.error(err)
            this.sendMessage(err.message ? err.message.split('\n').filter(line => /^ERROR: /.test(line)).join('\n') : 'can\'t get duration')
          })
        }
        else if (fiku) {
          const media = parseLink(url)
          if (media.type) return this.mediaSend({ type: media.type, id: media.id, pos: 'next', title })
          if (media.msg) this.sendMessage(media.msg)
        } else this.sendByFilter('Kann ' + url + ' nicht addieren. Addierbare Hosts: ' + [...allowedHosts, ...needManifest, ...needUserScript].join(', '))
      } else this.sendMessage('Ist keine Elfe /pfräh')
    } else this.sendMessage('Graunamen detektiert. /verdacht')
  }
}
