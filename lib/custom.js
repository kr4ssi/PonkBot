/*!
**|   PonkBot Custom Functions
**@
*/

'use strict';

const request = require('request')

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
    return new Promise((resolve, reject) => {
      gitclient.RepositoryFiles.edit(...gitArr).then(result => {
        count--
        if (waiting.length) this.pushToGit(...waiting.shift())
        resolve()
      }).catch(err => {
        if (err.statusCode == 400 && err.error.message === 'A file with this name doesn\'t exist') {
          gitObj.commit_message = 'created'
          gitclient.RepositoryFiles.create(...gitArr).then(result => {
            count--
            if (waiting.length) this.pushToGit(...waiting.shift())
            resolve()
          }).catch(err => {
            console.error(err)
          })
        }
        else console.error(err)
      })
    })
  },
  createEmoteCSS: function() {
    return new Promise((resolve, reject) => this.db.knex('emotes').whereNotNull('width').orWhereNotNull('height').select('emote', 'width', 'height').then(sizes => {
      this.emoteCSS = sizes.filter(size => (((size.width > 0) && (size.width != 100)) || ((size.height > 0) && (size.height != 100)))).map(size => {
        return '.channel-emote[title="' + size.emote + '"] {\r\n' +
        ((size.width > 0) && (size.width != 100) ? ('  max-width: ' + ((size.width < 999) ? (size.width + 'px') : '100%') + ' !important;\r\n') : '') +
        ((size.height > 0) && (size.height != 100) ? ('  max-height: ' + ((size.height < 999) ? (size.height + 'px') : '100%') + ' !important;\r\n') : '') +
        '}'
      }).join('\r\n')
      console.log(this.emoteCSS)
      resolve()
    }))
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
    if (!this.meeseeks('filteredit')) {
      if (force) return this.sendMessage('Für diese Funktion muss ich Filter erstellen dürfen')
      return this.sendMessage(message)
    }
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
  }
}
