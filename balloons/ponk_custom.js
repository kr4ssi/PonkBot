/*!
**|   PonkBot Custom Commands
**@
*/

'use strict';

const request = require('request')
const validUrl = require('valid-url')

const Gitlab = require('gitlab').Gitlab
const gitclient = new Gitlab({
  token: process.env.api_gitlab
})
const gitrepo = process.env.gitrepo

let count = 0
const waiting = []
let lastImages = []

const quotes = {
  zen: require('./quotes/zen.js'),
  stoll: require('./quotes/stoll.js'),
  hitler: require('./quotes/hitler.js'),
  breifick: require('./quotes/breifick.js'),
  ratschlag: require('./quotes/ratschlag.js'),
  tourette: require('./quotes/tourette.js'),
  frage: require('./quotes/frage.js'),
  fut: [
    'Fut',
    'Doppelfut',
    'Labbrige Doppelfut',
    'Futschlecker',
    'Garstiger Futlappen'
  ],
  armbernd: [
    '/tarm',
    '/armmoderiert',
    '/armbernd',
    '/sarm',
    '/fritt'
  ],
  saufen: [
    '/lahey',
    '/stoss',
    '/saufi',
    '/saufen',
    '/wein',
    '/lüning',
    '/stollschluck',
    '/schluck',
    '/tschluck',
    '/tadler',
    '/schunkel',
    '/bebe',
    '/kirk'
  ]
}
const quote = command => quotes[command][Math.floor(Math.random() * quotes[command].length)]
const cleanban = []
const lastCSS = {
  logo: '',
  hintergrund: ''
}

function sendquote(user, params, meta) {
  this.sendByFilter(quote(meta.command))
}
module.exports = {
  handlers: {
    zen       : sendquote,
    stoll     : sendquote,
    hitler    : sendquote,
    breifick  : sendquote,
    ratschlag : sendquote,
    fut       : sendquote,
    frage: function(user, params, meta) {
      const randuser = this.userlist[Math.floor(Math.random() * this.userlist.length)].name
      this.sendMessage(quote(meta.command).replace(/\${randuser}/, randuser))
    },
    armbernd: function(user, params, meta) {
      const regex = /armbernd/g
      let tempstr = quote(meta.command)
      while (regex.exec(params)) {
        tempstr += ' ' + quote(meta.command)
      }
      this.sendMessage(tempstr)
    },
    saufen: function(user, params, meta) {
      const notafk = this.userlist.filter(user => ![this.name, 'kr4ssi'].includes(user.name) && !user.meta.afk)
      const randuser = notafk[Math.floor(Math.random() * notafk.length)].name
      const messages = [
        `Ich sage: ${randuser} muss saufen.`,
        `${randuser} wurde aus allen zum saufen ausgewählt.`,
        `Heute wird sich totgesoffen, ${randuser}.`,
        `Verabschiede dich von deine Leber, ${randuser}.`,
        `${randuser}! Kanalisiere deinen inneren kr4ssi.`,
        `Lass den Rosé stehen ${randuser} und pack den Männerschnappes aus.`,
        `Mr. ${randuser}, lassen sie den Schnaps aus Ihnen sprechen.`
      ]
      this.sendMessage(messages[Math.floor(Math.random() * messages.length)] + ' ' + quote(meta.command))
    },
    tourette: function(user, params, meta) {
      if (Math.random() < 0.7) return this.sendMessage(quote(meta.command))
      const tourette1 = ['RAH', 'BRU', 'WAH', 'PAM', 'GNA']
      const tourette2 = ['A', 'H', 'G', 'W', 'R']
      const rand = (min, max) => Math.floor(Math.random() * (max - min)) + min
      const rahs = rand(3, 6)
      const ahs = rand(5, 11)
      let tourette = ''
      for (let i = 0; i < rahs; i++) {
        tourette += tourette1[rand(0, tourette1.length)]
      }
      for (let i = 0; i < ahs; i++) {
        const intpos = rand(0, tourette.length)
        tourette = tourette.slice(0, intpos) + tourette2[rand(0, tourette2.length)] + tourette.slice(intpos)
      }
      this.sendMessage(tourette)
    },
    pizza: function(user, params, meta) {
      if (!/^[1-9][0-9]?(\.[0-9]{1-3})?$/.test(params)) return this.sendMessage('Du musst eine Zeit unter 100 Minuten angeben /ööäähh')
      this.sendPrivate('Werde dich nach ' +  params + ' Minuten erinnern.', user)
      setTimeout(() => {
        this.sendPrivate('/alarm', user)
      }, params * 1000 * 60)
    },
    oder: function(user, params, meta) {
      const splitParams = params.split(';')
      if (splitParams.length < 2) return this.sendMessage('Zu wenig Parameter gegeben.', user)
      this.sendMessage('Ich habe entschieden: ' + splitParams[Math.floor(Math.random() * splitParams.length)].trim())
    },
    aufräumen: function(user, params, meta) {
      if (!/\w/.test(params)) return this.sendMessage('Es muss ein Nutzer spezifiziert werden.', user)
      if (cleanban.includes(user)) return this.sendMessage('Aufräumen ist für dich nicht mehr verfügbar.')
      let username = new RegExp('^' + params, 'i')
      const isinplaylist = this.playlist.find(item => item.temp && username.test(item.queueby))
      if (!isinplaylist) return this.sendMessage('Benutzer nicht in der Playlist.')
      username = isinplaylist.queueby
      this.pollAction({
        title: 'Sollen alle Videos von ' + username + ' aus der Liste entfernt werden?',
        timeout: 30,
        opts: ['Ja /krebs', 'Nein /top'],
        obscured: false
      }, pollvotes => {
        if (pollvotes[0] <= pollvotes[1]) return this.sendMessage('Es werden keine Videos entfernt /feelsok')
        this.sendMessage('Alle Videos von ' + username + ' werden entfernt /gas')
        //this.sendMessage('/clean ' + username, { ignoremute: true })
        const playlist = this.playlist.filter(item => item.temp && item.queueby === username)
        playlist.forEach((item, i) => setTimeout(() => this.mediaDelete(item.uid), i * 200))
        cleanban.push(user)
        setTimeout(() => {
          cleanban.splice(cleanban.indexOf(user), 1)
        }, 4 * 1000 * 60 * 60) //Cooldown
      })
    },
    lastimage: function(user, params, meta) {
      let backstr = 'Zuletzt'
      let back = 0
      if (params.match(/^[1-9]$/)) {
        back = Number(params)
        backstr = (back + 1) + '.-zuletzt'
      }
      this.getLastImage(back).then(image => {
        this.sendMessage(backstr + ' pfostiertes bild: ' + image + '.pic')
      })
    },
    alle: function(user, params, meta) {
      this.sendByFilter(this.userlist.map(user => user.name).sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'})).join(' '))
    },
    userpoll: function(user, params, meta){
      if(!this.meeseeks('pollctl')){
        return this.sendPrivate(`I lack this capability due to channel permission settings.`, user)
      }
      if (!/\w/.test(params)) return this.sendMessage('Und die Frage /fz')
      this.client.createPoll({
        title: params,
        opts: this.userlist.map(user => user.name).sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'})),
        obscured: false
      })
    },
    rüge: function(user, params, meta) {
      if (!/\w/.test(params)) return this.sendMessage('Wer soll gerügt werden /frage')
      this.pollAction({
        title: 'Soll über ' + params + ' eine öffentliche Rüge ausgesprochen werden?',
        //timeout: 0,
        opts: ['j', 'n'],
        obscured: false
      }, pollvotes => {
        if (pollvotes[0] > pollvotes[1]) this.sendMessage(params + ' erhält hiermit eine öffentliche Rüge durch den Krautsynch')
      })
    },
    willkürpoll: function(user, params, meta){
      const playlist = this.playlist.filter(row => row.temp)
      if (playlist.length > 2) {
        this.pollAction({
          title: 'Was willküren',
          timeout: 30,
          opts: playlist.map(row => row.uid != this.currUID ? row.media.title : 'Garnichts'),
          obscured: false
        }, pollvotes => {
          this.mediaMove({from: playlist[pollvotes.indexOf(Math.max(...pollvotes))].uid})
        })
      }
    },
    springpoll: function(user, params, meta){
      const playlist = this.playlist.filter(row => row.temp)
      if (playlist.length > 0 && !playlist.find(item => item.uid == this.currUID)) {
        this.pollAction({
          title: 'Willkürüberspringen der permanenten Videos /ffz',
          timeout: 20,
          opts: ['j', 'n'],
          obscured: false
        }, pollvotes => {
          if (pollvotes[0] > pollvotes[1]) this.client.jump(playlist[0].uid)
          //else sendMessage('Wird nicht gewillkürt')
        })
      }
    },
    mischenpoll: function(user, params, meta){
      if(!this.meeseeks('playlistmove')){
        return this.sendPrivate(`I lack this capability due to channel permission settings.`, user)
      }
      const playlist = this.playlist.filter(row => row.temp && row.uid != this.currUID).map(row => row.uid)
      if (playlist.length > 2) {
        this.pollAction({
          title: 'Mischen /ffz',
          timeout: 20,
          opts: ['j', 'n'],
          obscured: false
        }, pollvotes => {
          if (pollvotes[0] > pollvotes[1] + 1) playlist.forEach((uid, i, uids) => {
            let afteruids = uids.filter(row => row != uid)
            if (i > 0) afteruids = [this.currUID, ...afteruids]
            if (i == uids.length - 1) afteruids.pop()
            setTimeout(() => {
              this.mediaMove({from: uid, after: afteruids[Math.floor(Math.random() * afteruids.length)]})
            }, i * 200)
            //else sendMessage((pollvotes[0] == pollvotes[1] + 1) : 'Müssen 2 meer sein' ? 'Es wird nicht gemischt')
          })
        })
      }
    },
    rehost: function(user, params, meta) {
      const rehostImage = image => {
        this.rehostUrl(image).then(image => {
          this.sendMessage(image + '.pic')
        }, (err, msg) => {
          console.error(err)
          if (msg) this.sendMessage(msg)
        })
      }
      if (!params || params.match(/^[1-9]$/)) return this.getLastImage(Number(params)).then(rehostImage)
      const emote = params.match(/^\/[\wäÄöÖüÜß]+/) && this.emotes.find(emote => emote.name == params)
      if (emote) params = emote.image
      const url = validUrl.isHttpsUri(params)
      if (!url) return this.sendMessage('Ist keine https-Elfe /pfräh')
      rehostImage(url)
    },
    addemote: function(user, params, meta) {
      if (!params.match(/^\/[\wäÄöÖüÜß]+/)) return this.sendMessage('Muss mit / anfangen und aus Buchstaben, oder Zahlen bestehen')
      const split = params.trim().split(' ')
      const name = split.shift()
      let image = split.join().trim()
      if (!image) return this.getLastImage().then(image => {
        this.client.socket.emit('updateEmote', { name, image })
      })
      image = validUrl.isHttpsUri(image)
      if (!image) return this.sendMessage('Ist keine https-Elfe /pfräh')
      if (/\.json$/.test(image)) return this.fetch(image, {
        json: true
      }).then(emotes => {
        const emote = emotes.find(emote => emote.name == name)
        if (!emote) return this.sendMessage('Emote nicht gefunden')
        this.client.socket.emit('updateEmote', { name, image: emote.image })
      })
      this.client.socket.emit('updateEmote', { name, image })
    },
    emote: function(user, params, meta) {
      if (!params.match(/^\/[\wäÄöÖüÜß]+$/) || !this.emotes.some(emote => emote.name == params)) return this.sendMessage('Ist kein emote')
      this.db.knex('emotes')
      .where({ emote: params })
      .select('count', 'lastuser', 'width', 'height')
      .then(result => {
        let count = 0
        let byuser = ''
        let width = 0
        let height = 0
        if (result.length > 0) {
          result = result.pop()
          count = result.count || 0
          width = result.width || 0
          height = result. height || 0
          if (result.lastuser) byuser = '. Zuletzt von: ' + result.lastuser
        }
        this.sendMessage('Emote ' + params + ' wurde ' + count + ' mal pfostiert' + byuser +
        ((width > 0) && (width != 100) ? ('. Maximale Breite: ' + ((width < 999) ? (width + 'px') : '100%')) : '') +
        ((height > 0) && (height != 100) ? ('. Maximale Höhe: ' + ((height < 999) ? (height + 'px') : '100%')) : ''))
      })
    },
    emotesize: function(user, params, meta) {
      const split = params.trim().split(' ')
      const emote = split.shift().trim()
      if (!emote.match(/^\/[\wäÄöÖüÜß]+$/) || !this.emotes.some(emotelist => emotelist.name == emote)) return this.sendMessage('Ist kein emote')
      const size = {};
      while (params = split.shift()) if (params = params.trim().match(/(w|h)(\d{1,4})/)) {
        if (params[1] === 'w') size.width = params[2]
        else if (params[1] === 'h') size.height = params[2]
      }
      if (!size.width && !size.height) return this.sendMessage('Zu wenig parameter')
      this.db.knex('emotes').insert({ emote, ...size }).catch(() => {
        return this.db.knex('emotes').where({ emote }).update(size)
      }).then(() => {
        this.createEmoteCSS().then(() => this.pushToGit('emotes.css', this.emoteCSS).then(() => this.client.socket.emit('setChannelCSS', {
          css: this.channelCSS.replace(/\/emotes\.css\?[^"]+/, '/emotes.css?' + Math.random().toString(36).slice(2))
        })))
      })
    },
    selbstsäge: function(user, params, meta) {
      const lastbyuser = this.playlist.filter(item => item.queueby === user && item.temp).pop()
      if (lastbyuser) this.mediaDelete(lastbyuser.uid)
    },
    aip: async function(user, params, meta) {
      if (!params || params.match(/^[1-9]$/)) params = await this.getLastImage(Number(params))
      const emote = params.match(/^\/[\wäÄöÖüÜß]+/) && this.emotes.find(emote => emote.name == params)
      if (emote) params = emote.image
      const url = validUrl.isHttpsUri(params)
      if (!url) return this.sendMessage('Ist keine https-Elfe /pfräh')
      console.log(params)
      request({
        url,
        encoding: null
      }, (err, res, body) => {
        if (err || res.statusCode !== 200) {
          console.error(err || statusCode)
          return this.sendMessage('download failed')
        }
        const contentType = res.headers['content-type'] || 'image/jpeg'
        let ext = contentType.split('/').pop()
        if (ext === 'jpeg') ext = 'jpg'
        request.post({
          url: 'https://aiportraits.com/art-api/aiportrait/',
          formData: {
            file: {
              value: body,
              options: {
                filename: 'image.' + ext,
                contentType
              }
            }
          }, json: true
        }, (err, res, body) => {
          if (err || res.statusCode !== 200) {
            console.error(err || res.statusCode)
            return this.sendMessage('upload failed')
          }
          console.log(body)
          if (body.ERROR) return this.sendMessage(body.ERROR)
          if (!body.filename) return this.sendMessage('parsing error')
          this.addLastImage('https://aiportraits.com/portraits/' + body.filename).then(image => {
            this.sendMessage(image + '.pic')
          })
        })
      })
    },
    hintergrund: logoHintergrund,
    logo: logoHintergrund,
    help: function(user, params, meta) {
      if (this.commands.helpdata.hasOwnProperty(params)) this.sendByFilter(this.commands.helpdata[params].synop +
        ((params === 'add' && this.API.add) ? this.API.add.allowedHostsString : '') +
        (this.commands.helpdata[params].rank > 1 ? '. Geht ab Level: ' + this.commands.helpdata[params].rank :
        (this.commands.helpdata[params].rank === 1 ? '. Geht nur für registrierte User' : '')))
        else this.sendByFilter('Verfügbare Befehle: ' + Object.keys(this.commands.handlers).join(', '))
      },
      update: function(user, params, meta) {
        this.server.update()
      }
    },
    helpdata: require('./help.js'),
    meta: {
      active: true,
      type: 'giggle'
    },
    giggle: function(ponk){
      return new Promise((resolve, reject) => {
        Object.assign(ponk, {
          checkMessageTrigger: function(user, message) {
            if (![
              ponk.name,
              '[server]',
              'Kommandant'
            ].includes(user)) {
              let match
              let regex = /(?<=^|\s)(\/[a-zA-Z0-9ßäöüÄÖÜ]+)(?=\s|$)/g
              const emotes = {}
              while (match = regex.exec(message)) {
                const emote = ponk.emotes.find(emote => emote.name == match[1])
                if (!emote) continue
                if (!emotes[emote.name]) emotes[emote.name] = 1
                else emotes[emote.name]++
              }
              Object.keys(emotes).forEach(emote => {
                const count = emotes[emote]
                ponk.db.knex('emotes').insert({ emote, count, lastuser: user}).catch(() => {
                  return ponk.db.knex('emotes').where({ emote }).increment({ count }).update({ lastuser: user })
                }).then(() => {
                  //ponk.logger.log('Emote used: ' + emote + ' ' + count + ' times by ' + user)
                })
              })
              regex = /<img class="image-embed-small" src="(https?:\/\/[^"]+)" \/>/g
              while (match = regex.exec(message)) {
                ponk.addLastImage(match[1])
              }
              if (message.match(new RegExp('^' + ponk.name + '|[^!.$/]' + ponk.name))) {
                const quotes = [
                  'Hiiiiiiii',
                  'jaaaah?',
                  'ja morgen',
                  'w-was?',
                  'lass mich',
                  'hihi',
                  'iiich?'
                ]
                if (user === 'melli17') ponk.sendMessage('/knuddeln')
                else ponk.sendMessage(quotes[Math.floor(Math.random() * quotes.length)])
              }
            }
          },
          pushToGit: function(filename, content, encoding) {
            if (count > 0) return waiting.push(arguments)
            count++
            const gitObj = { commit_message: 'updated' }
            if (encoding) gitObj.encoding = encoding
            const gitArr = [gitrepo, filename, 'master', content, gitObj.commit_message, gitObj]
            return new Promise((resolve, reject) => {
              gitclient.RepositoryFiles.edit(...gitArr).then(result => {
                count--
                if (waiting.length) ponk.pushToGit(...waiting.shift())
                resolve()
              }).catch(err => {
                if (err.response && err.response.status == 400 && err.description === 'A file with ponk name doesn\'t exist') {
                  const gitArr = [gitrepo, filename, 'master', content, 'created', gitObj]
                  gitObj.commit_message = 'created'
                  gitclient.RepositoryFiles.create(...gitArr).then(result => {
                    count--
                    if (waiting.length) ponk.pushToGit(...waiting.shift())
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
            return new Promise((resolve, reject) => ponk.db.knex('emotes').whereNotNull('width').orWhereNotNull('height').select('emote', 'width', 'height').then(sizes => {
              ponk.emoteCSS = sizes.filter(size => (((size.width > 0) && (size.width != 100)) || ((size.height > 0) && (size.height != 100)))).map(size => {
                return '.channel-emote[title="' + size.emote + '"] {\r\n' +
                ((size.width > 0) && (size.width != 100) ? ('  max-width: ' + ((size.width < 999) ? (size.width + 'px') : '100%') + ' !important;\r\n') : '') +
                ((size.height > 0) && (size.height != 100) ? ('  max-height: ' + ((size.height < 999) ? (size.height + 'px') : '100%') + ' !important;\r\n') : '') +
                '}'
              }).join('\r\n')
              resolve()
            }))
          },
          addLastImage: function(image) {
            return new Promise((resolve, reject) => {
              if (image === lastImages[0]) return resolve(image)
              lastImages.unshift(image)
              ponk.db.knex('lastimage').insert({ image }).then(() => {
                //ponk.logger.log('Image posted: ' + image)
                resolve(image)
              }, error => {
                ponk.logger.error('Unexpected error', '\n', error);
                resolve(image)
              })
            })
          },
          getLastImage: function(back) {
            if (!back) back = 0
            return new Promise(resolve => {
              if (lastImages.length > back + 1) return resolve(lastImages[back])
              ponk.db.knex('lastimage')
              .select('image').limit(back + 1).orderBy('id', 'desc').then(result => {
                if (result.length > back) {
                  lastImages = result.map(row => row.image)
                  resolve(lastImages[back])
                }
              }, err => resolve(ponk.sendMessage('fehler')))
            })
          },
          rehostUrl: function(url, host = ponk.API.keys.imagehost) {
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
                  ponk.addLastImage(image).then(image => {
                    resolve(image)
                  })
                })
              })
            })
          },
          sendByFilter: function(message, force) {
            if (!ponk.meeseeks('filteredit')) {
              if (force) return ponk.sendMessage('Für diese Funktion muss ich Filter erstellen dürfen')
              return ponk.sendMessage(message)
            }
            if (message.length < 320 && !force) return ponk.sendMessage(message)
            const limit = 1000
            const count = Math.ceil(message.length / limit)
            for (let i = 0; i < count; i++) {
              const filterstring = '###' + Math.random().toString(36).slice(2) + '###'
              ponk.client.socket.emit('updateFilter', {
                name: 'Bot filter',
                source: filterstring,
                replace: message.substr(i * limit, limit),
                flags: '',
                active: true
              })
              ponk.sendMessage(filterstring)
              ponk.client.socket.emit('updateFilter', {
                name: 'Bot filter',
                source: '',
                replace: '',
                flags: ''
              })
            }
          },
          pollAction: function(poll, callback) {
            if(!ponk.meeseeks('pollctl')){
              return ponk.sendPrivate(`I lack ponk capability due to channel permission settings.`, user)
            }
            ponk.client.createPoll(poll)
            ponk.client.once('newPoll', poll => {
              let timeout = false
              if (poll.timeout && poll.timeout > 10) {
                timeout = setTimeout(() => {
                  ponk.sendMessage('Noch 10 Sekunden Zeit abzustimmen.', { ignoremute: true })
                }, (poll.timeout - 10) * 1000)
              }
              ponk.client.once('closePoll', () => {
                timeout && clearTimeout(timeout)
                if (callback && typeof(callback) === 'function') {
                  callback(ponk.pollvotes)
                }
              })
            })
          }
        })
        ponk.createEmoteCSS()
        ponk.logger.log('Registering custom handlers');
        resolve();
      })
    }
  }
  function cssReplace(command, addCSS) {
    let css = this.channelCSS
    const tagText = `Bot-CSS "${command}" do not edit`
    const myRegEx = '\\/\\*\\s' + tagText + '\\s\\*\\/'
    const myMatch = css.match(new RegExp('\\s' + myRegEx + '([\\S\\s]+)' + myRegEx, 'i'))
    const cssNew = '\n/* ' + tagText + ' */\n' + (addCSS || lastCSS[command]) + '\n/* ' + tagText + ' */'
    if (myMatch) {
      const cssOld = myMatch[1].trim()
      if (cssOld.length > 0 && lastCSS[command] != cssOld) lastCSS[command] = cssOld
      css = css.replace(myMatch[0], cssNew)
    }
    else css += cssNew
    this.client.socket.emit('setChannelCSS', {css})
  }
  function logoHintergrund(user, params, meta) {
    let css1, css2, options, message, rank
    const command = meta.command
    if (command === 'logo') {
      css1 = '#leftpane-inner:after { background-image:url("',
      css2 = '"); }',
      message = 'Verfügbare Logos: '
      options = {
        FIKU: 'https://tinyimg.io/i/wVmC0iw.png',
        KS: 'https://tinyimg.io/i/NF44780.png',
        Partei: 'https://tinyimg.io/i/JlE5E57.png',
        Heimatabend: 'https://tinyimg.io/i/vPBysg8.png'
      }
    }
    else if (command === 'hintergrund') {
      css1 = 'body { background-image:url("'
      css2 = '"); }'
      message = 'Verfügbare Hintergründe: '
      options = {
        Partei: 'https://framapic.org/wNoS851YWyan/bKKxkMmYIGeU',
        Synthwave: 'https://i.imgur.com/JnSmM2r.jpg',
        Sterne: 'https://tinyimg.io/i/Z48nCKm.gif',
        KinoX: 'https://tinyimg.io/i/4DUPI3z.jpg',
        Donald: 'https://s16.directupload.net/images/190225/29lmm2s3.jpg',
        Mödchen: 'https://framapic.org/c96PYIXOep4s/tdnZDLRiNEis',
        Nacht: 'https://framapic.org/6B7qKZuvbmcU/NPa1SiDUXbCK'
      }
    }
    if (params) {
      if (params != 'last') {
        if (options.hasOwnProperty(params)) params = options[params]
        else {
          const emote = params.match(/^\/[\wäÄöÖüÜß]+/) && this.emotes.find(emote => emote.name == params)
          if (emote) params = emote.image
        }
        params = validUrl.isHttpsUri(params)
        if (!params) return this.sendMessage('Ist keine https-Elfe /pfräh')
        cssReplace.call(this, command, css1 + params + css2)
      }
      else cssReplace.call(this, command)
    }
    else this.sendByFilter(message + Object.keys(options).join(', '))
  }
