/*!
**|   PonkBot Custom Functions
**@
*/

'use strict';

const parseLink = require('./parselink.js')
const request = require('request')
const validUrl = require('valid-url')

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
        url = url.replace('https://synchapi.herokuapp.com/add.json?url=', '')
        const urlbak = url
        url = url.replace(/https?:\/\/o(pen)?load\..*\/(f|embed)\/(.+)/, 'https://openload.co/f/$3&redir=true')
        url = url.replace(/https?:\/\/(streamango\.com|fruithosts\.net)\/(f|embed)\/(.+)/, 'https://streamango.com/f/$3&redir=true')
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
        else if (/.*\.m3u8$/.test(url) || [...needManifest, ...needUserScript].some(allowed => new RegExp('^https?:\\/\\/([-\\w]+\\.)*' + allowed + '\\/.+', 'i').test(url))) {
          const link = 'https://synchapi.herokuapp.com/add.json?url=' + url + (title ? '&title=' + encodeURIComponent(title) : '')
          const timeout = setTimeout(() => this.sendMessage('Addieren kann bis zu 30 Sekunden dauern...'), 5000)
          request({url: link, json: true}, (err, res, body) => {
            clearTimeout(timeout)
            if (err || res.statusCode != 200 || !body.sources) {
              this.sendMessage('fehler: ' + body.title)
              return console.error(err || body)
            }
            this.addNetzm(link, (params != cleanparams), user, 'cm', title)
            if (needUserScript.some(allowed => new RegExp('^https?:\\/\\/([-\\w]+\\.)*' + allowed + '\\/.+', 'i').test(url))) this.client.createPoll({
              title: title || body.title,
              opts: ['Geht nur mit Userscript', 'https://github.com/kr4ssi/synch-api/raw/master/ks.user.js (update vom 18.3.19)', 'dann ' + urlbak + ' öffnen', 'Ok klicken und falls es schon läuft player neu laden'],
              obscured: false
            })
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
