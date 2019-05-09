/*!
**|   PonkBot Custom Functions
**@
*/

'use strict';

const parseLink = require('./parselink.js')
const request = require('request')
const URL = require('url')
const path = require('path')
const validUrl = require('valid-url')

const { execFile } = require('child_process')

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
      const emotes = {}
      while (match = regex.exec(message)) {
        const emote = this.emotes.find(emote => emote.name == match[1])
        if (!emote) continue
        if (!emotes[emote.name]) emotes[emote.name] = 1
        else emotes[emote.name]++
      }
      Object.keys(emotes).forEach(emote => {
        const count = emotes[emote]
        this.db.knex('emotes').insert({ emote, count, lastuser: user}).catch(() => {
          return this.db.knex('emotes').where({ emote }).increment({ count }).update({ lastuser: user })
        }).then(() => {
          //this.logger.log('Emote used: ' + emote + ' ' + count + ' times by ' + user)
        })
      })
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
      count--
      if (waiting.length) pushToGit(...waiting.shift())
    }).catch(err => {
      if (err.statusCode == 400 && err.error.message === 'A file with this name doesn\'t exist') {
        gitObj.commit_message = 'created'
        gitclient.RepositoryFiles.create(...gitArr).then(result => {
          count--
          if (waiting.length) pushToGit(...waiting.shift())
        }).catch(err => {
          console.error(err)
        })
      }
      else console.error(err)
    })
  },
  fetch: function (url, { qs = {}, form = false, method = 'get', json = true, getprop = false, getlist = false, getrandom = false, customerr = [] } = {}) {
    return new Promise((resolve, reject) => {
      console.log('Fetch:', url, qs, form, method, json, getprop, getlist, getrandom, customerr)
      if ((getlist || getprop) && !json) return console.error('json must set to true')
      if (getrandom && !getlist) return console.error('getrandom from where')
      request({ url, qs, form, method, json }, (err, res, body) => {
        if (err) {
          this.sendMessage(err.message)
          console.error(err)
          return
        }
        if (res.statusCode != 200) {
          if (customerr.includes(res.statusCode)) return resolve(res.statusCode)
          this.sendMessage('Status: ' + res.statusCode)
          console.error(body)
          return
        }
        if (getprop) {
          if (!body[getprop]) return this.sendMessage('Keine Ergebnisse /elo')
          body = body[getprop]
        }
        if (getlist) {
          if (!body[getlist] || body[getlist].length < 1) return this.sendMessage('Keine Ergebnisse /elo')
          body = body[getlist]
          if (getrandom) body = body[Math.floor(Math.random() * body.length)]
        }
        resolve(body)
      })
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
          }, json: true
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
  add: function(url, title, { user, willkür, fiku }) {
    let host = {}
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
      if (!cache) this.cmManifests[url.replace(/https:\/\/(openload.co|oload\.[a-z0-9-]{2,})\/(f|embed)\//, 'https://openload.co/f/').replace(/https:\/\/(streamango\.com|fruithosts\.net)\/(f|embed)\//, 'https://streamango.com/f/')] = {
        manifest,
        //timestamp,
        user: {}
      }
      if (host.needUserScript) {
        manifest.sources[0].url = this.server.weblink + '/redir?url=' + url
        this.client.createPoll({
          title: manifest.title,
          opts: [
            'Geht nur mit Userscript',
            this.server.weblink + '/ks.user.js (update vom ' + this.server.userscriptdate + ')',
            'dann ' + url + ' öffnen',
            'Ok klicken und falls es schon läuft player neu laden'
          ],
          obscured: false
        })
      }
      this.addNetzm(this.server.weblink + '/add.json?url=' + url, willkür, user, 'cm', manifest.title)
    }
    const getDuration = (manifest, info = {}) => {
      return new Promise((resolve, reject) => {
        if (manifest.live || manifest.duration) return resolve(manifest)
        let tries = 0
        const tryToGetDuration = err => {
          if (err) {
            console.error(err)
            if (tries > 1) {
              return this.sendMessage('Can\'t get duration')
            }
          }
          tries++
          let params = ['-v', 'error', '-show_format', '-show_streams', '-icy', '0', '-print_format', 'json']
          if (info.http_headers) {
            const headers = Object.entries(info.http_headers).map(([key, value]) => key + ': ' + value).join('\r\n')
            console.log(headers)
            params = [...params, '-headers', headers]
          }
          execFile('ffprobe', [...params, manifest.sources[0].url], (err, stdout, stderr) => {
            if (err) return tryToGetDuration(err)
            console.log(stderr)
            let info
            try {
              info = JSON.parse(stdout)
            }
            catch(err) {
              return console.error(err)
            }
            console.log(info.format)
            if (info.format && info.format.duration) resolve(Object.assign(manifest, { duration: parseFloat(info.format.duration) }))
            else tryToGetDuration(info)
          })
        }
        tryToGetDuration()
      })
    }
    const nxLoad = () => {
      this.fetch(url.replace(/embed-/i, ''), {
        json: false
      }).then(body => {
        const regMatch = body.match(/master\.m3u8","([^"]+)","([^"]+)"/i)
        if (!regMatch) {
          this.sendMessage('Fehler')
          return console.error(body)
        }
        const titleMatch = body.match(/<title>Watch ([^<]+)/i)
        if (!title && titleMatch) title = titleMatch[1]
        manifest.title = title
        manifest.sources[0].url = regMatch[2].replace(/^http:\/\//i, 'https://')
        manifest.sources[0].contentType = 'video/mp4'
        manifest.sources[1] = {}
        manifest.sources[1].url = regMatch[1].replace(/^http:\/\//i, 'https://')
        manifest.sources[1].contentType = 'video/mp4'
        manifest.sources[1].quality = 1080
        getDuration(manifest).then(sendJson)
        //this.addNetzm(regMatch[1].replace(/^http:\/\//i, 'https://'), willkür, user, 'fi', title)
      })
    }
    if (url.match(/https?:\/\/(?:www\.)?nxload\.com\/(?:embed-)?(\w+)/i)) return nxLoad()
    if (/.*\.m3u8$/.test(url)) return getDuration(manifest).then(sendJson)
    host = allowedHosts.find(host => host.regex.test(url))
    if (host) return execFile('youtube-dl', ['--dump-json', '-f', 'best', '--restrict-filenames', url], {
      maxBuffer: 10485760
    }, (err, stdout, stderr) => {
      if (err) {
        this.sendMessage(err.message && err.message.split('\n').filter(line => /^ERROR: /.test(line)).join('\n'))
        return console.error(err)
      }
      let data = stdout.trim().split(/\r?\n/)
      let info
      try {
        info = data.map((rawData) => JSON.parse(rawData))
      }
      catch(err) {
        return console.error(err)
      }
      if (!info.title) info = info[0];
      console.log(info)
      title = title || ((new RegExp('^' + info.extractor_key, 'i')).test(info.title) ? info.title : (info.extractor_key + ' - ' + info.title))
      if (!host.needManifest) return this.addNetzm(info.url.replace(/^http:\/\//i, 'https://'), willkür, user, 'fi', title, url)
      manifest.title = title
      if (info.manifest_url) manifest.sources[0].url = info.manifest_url
      else {
        manifest.sources[0].url = info.url
        manifest.sources[0].contentType = ([
          {type: 'video/mp4', ext: ['.mp4']},
          {type: 'video/webm', ext: ['.webm']},
          {type: 'application/x-mpegURL', ext: ['.m3u8']},
          {type: 'video/ogg', ext: ['.ogv']},
          {type: 'application/dash+xml', ext: ['.mpd']},
          {type: 'audio/aac', ext: ['.aac']},
          {type: 'audio/ogg', ext: ['.ogg']},
          {type: 'audio/mpeg', ext: ['.mp3', '.m4a']}
        ].find(contentType => contentType.ext.includes(path.extname(URL.parse(info.url).pathname))) || {}).type || 'video/mp4'
      }
      if (host.host === 'rapidvideo.com') {
        manifest.title = manifest.title.replace(/^Generic/, 'Rapidvideo')
        url = url.replace(/rapidvideo\.com\/e\//, 'rapidvideo.com/v/')
      }
      if ([240, 360, 480, 540, 720, 1080, 1440].includes(info.width)) manifest.sources[0].quality = info.width;
      if (info.thumbnail && info.thumbnail.match(/^https?:\/\//i)) manifest.thumbnail = info.thumbnail.replace(/^http:\/\//i, 'https://')
      manifest.sources[0].url = manifest.sources[0].url.replace(/^http:\/\//i, 'https://')
      manifest.duration = info.duration
      getDuration(manifest, info).then(sendJson)
    })
    if (!fiku) return this.sendByFilter('Kann ' + url + ' nicht addieren. Addierbare Hosts: ' + this.allowedHosts())
    const media = parseLink(url)
    if (media.type) return this.mediaSend({ type: media.type, id: media.id, pos: 'next', title })
    if (media.msg) this.sendMessage(media.msg)
  },
  allowedHosts: () => allowedHosts.map(host => host.host).join(', ')
}
const needUserScript = [
  'openload.co',
  'streamango.com',
  'rapidvideo.com'
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
  ...needUserScript
]
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
  'bitchute.com',
  ...needManifest
].map(host => ({
  regex: new RegExp('^https?:\\/\\/([-\\w]+\\.)*' + ({
    'openload.co': 'openload\\.(?:co|io|link|pw)|oload\\.(?:tv|stream|site|xyz|win|download|cloud|cc|icu|fun|club|info|pw|live|space|services)|oladblock\\.(?:services|xyz|me)|openloed\\.co'
  }[host] || host.replace('.', '\\.')) + '\\/.+', 'i'),
  needManifest: needManifest.includes(host),
  needUserScript: needUserScript.includes(host),
  host
}))
console.log(allowedHosts)
