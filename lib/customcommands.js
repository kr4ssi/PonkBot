/*!
**|   PonkBot Custom Commands
**@
*/

'use strict';

const request = require('request')
const validUrl = require('valid-url')
const urlExists = require('url-exists-deep')

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
let w0bm = ''
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
      if (splitParams.length < 2) return this.sendPrivate('Zu wenig Parameter gegeben.', user)
      this.sendMessage('Ich habe entschieden: ' + splitParams[Math.floor(Math.random() * splitParams.length)].trim())
    },
    aufräumen: function(user, params, meta) {
      if (!/\w/.test(params)) return this.sendPrivate('Es muss ein Nutzer spezifiziert werden.', user)
      if (cleanban.includes(user)) return this.sendMessage('Aufräumen ist für dich nicht mehr verfügbar.')
      let username = new RegExp('^' + params, 'i')
      const isinplaylist = this.playlist.find(item => username.test(item.queueby))
      if (typeof isinplaylist === 'undefined') return this.sendMessage('Benutzer nicht in der Playlist.')
      username = isinplaylist.queueby
      this.pollAction({
        title: 'Sollen alle Videos von ' + username + ' aus der Liste entfernt werden?',
        timeout: 30,
        opts: ['Ja /krebs', 'Nein /top'],
        obscured: false
      }, pollvotes => {
        if (pollvotes[0] <= pollvotes[1]) return this.sendMessage('Es werden keine Videos entfernt /feelsok')
        this.sendMessage('Alle Videos von ' + username + ' werden entfernt /gas')
        this.sendMessage('/clean ' + username, { ignoremute: true })
        cleanban.push(user)
        setTimeout(() => {
          cleanban.splice(cleanban.indexOf(user), 1)
        }, 4 * 1000 * 60 * 60) //Cooldown
      })
    },
    giphy: function(user, params, meta) {
      request({
        url: 'https://api.giphy.com/v1/gifs/search?q=' + params + '&api_key=' + this.API.keys.giphy + '&limit=5',
        json: true
      }, (err, res, body) => {
        if (err || res.statusCode != 200) return console.error(err || body)
        if (!body.data || body.data.length < 1) return this.sendMessage('Keine Ergebnisse /elo')
        const gifURL = body.data[Math.floor(Math.random() * body.data.length)].images.fixed_height.url.toString()
        this.sendMessage(gifURL + `.pic`)
      })
    },
    w0bm: function(user, params, meta) {
      const cleanparams = params.replace(/willkür$/, '').trim()
      const getW0bm = page => {
        request('https://w0bm.com/index?q=' + cleanparams + (page ? '&page=' + page : ''), (err, res, body) => {
          if (err || res.statusCode != 200) return console.error(err || body)
          const getMatches = (string, regex, index = 1) => {
            let matches = []
            let match
            while (match = regex.exec(string)) {
              matches.push(match[index])
            }
            return matches
          }
          if (!page) {
            const pages = getMatches(body, /&amp;page=(\d+)"/g)
            if (pages.length > 0) {
              const page = Math.ceil(Math.random() * Math.max(...pages))
              if (page > 1) return getW0bm(page)
            }
          }
          const vids = getMatches(body, /<tr data-thumb="(\d+)"/g)
          if (!vids || vids.length < 1) return this.sendMessage('Keine Ergebnisse /elo')
          w0bm = vids[Math.floor(Math.random() * vids.length)]
          this.sendMessage('https://w0bm.com/thumbs/' + w0bm + '.gif.pic')
        })
      }
      if (cleanparams.length > 0) return getW0bm()
      if (!w0bm) return request({
        url: 'https://w0bm.com/api/video/random',
        json: true
      }, (err, res, body) => {
        if (err || res.statusCode != 200) return console.error(err || body)
        this.addNetzm('https://b.w0bm.com/' + body.file, (params != cleanparams), user)
        this.sendMessage('Zufälliges netzm von w0bm.com addiert')
      })
      this.addNetzm('https://b.w0bm.com/' + w0bm + '.webm', (params != cleanparams), user)
      this.sendMessage('Letztes gif als netzm addiert')
      w0bm = false
    },
    netzm: function(user, params, meta) {
      const getFaden = faden => {
        request(faden, (err, res, body) => {
          if (err || res.statusCode != 200) return console.error(err || body)
          const regMatch = body.match(/(\/\w+\/src\/[0-9-]+\.(mp4|flv|webm|og[gv]|mp3|mov|m4a)\/[\w- ]+\.(mp4|flv|webm|og[gv]|mp3|mov|m4a))/g)
          if (regMatch) this.db.knex('netzms').where('faden', faden).del().then(() => {
            this.db.knex('netzms').insert(regMatch.map((netzm, index) => {
              return { faden: faden, nr: index + 1, netzm }
            })).then(() => {
              this.sendMessage(faden + ' ' + regMatch.length + ' netzms ladiert')
            })
          })
        })
      }
      const getNetzm = () => {
        this.db.knex('netzms').select('*').orderByRaw(this.db.client === 'mysql' ? 'rand()' : 'random()').limit(1).then(result => {
          if (result.length < 1) return this.sendMessage('Kein Faden ladiert')
          const row = result.pop()
          urlExists('https://kohlchan.net' + row.netzm).then(url => {
            if (!url) return urlExists(row.faden).then(url => {
              if (!url) return this.db.knex('netzms').where('faden', row.faden).del().then(getNetzm)
              this.db.knex('netzms').where('netzm', row.netzm).del().then(getNetzm)
            })
            this.addNetzm('https://kohlchan.net' + row.netzm, (params == 'willkür'), user)
            this.sendMessage('Zufälliges netzm aus ' + row.faden + ' addiert')
          })
        })
      }
      if (params === 'update') return this.db.knex('netzms').distinct('faden').then(result => {
        result.forEach(row => getFaden(row.faden))
      })
      if (params.match(/^https:\/\/(www.)?kohlchan\.net/i)) return getFaden(params)
      getNetzm()
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
      if (meta.rank < 3 ) return this.sendMessage('Geht nur ab lvl3')
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
      if (meta.rank < 2 ) return this.sendMessage('Geht nur ab lvl2')
      if (!/\w/.test(params)) return this.sendMessage('Wer soll gerügt werden /frage')
      this.pollAction({
        title: 'Soll über ' + params + ' eine öffentliche Rüge ausgesprochen werden?',
        timeout: 0,
        opts: ['j', 'n'],
        obscured: false
      }, pollvotes => {
        if (pollvotes[0] > pollvotes[1]) this.sendMessage(params + ' erhält hiermit eine öffentliche Rüge durch den Krautsynch')
      })
    },
    willkürpoll: function(user, params, meta){
      if (meta.rank < 2 ) return this.sendMessage('Geht nur ab lvl2')
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
      if (meta.rank < 3 ) return this.sendMessage('Geht nur ab lvl3')
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
      if (meta.rank < 3 ) return this.sendMessage('Geht nur ab lvl3')
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
      if (meta.rank < 2 ) return this.sendMessage('Geht nur ab lvl2')
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
      if (!url) return this.sendMessage('Ist keine Elfe /pfräh')
      rehostImage(url)
    },
    addemote: function(user, params, meta) {
      if (meta.rank < 3 ) return this.sendMessage('Geht nur ab lvl3')
      if (!params.match(/^\/[\wäÄöÖüÜß]+/)) return this.sendMessage('Muss mit / anfangen und aus Buchstaben, oder Zahlen bestehen')
      const split = params.trim().split(' ')
      const name = split.shift()
      let image = split.join().trim()
      if (!image) return this.getLastImage().then(image => {
        this.client.socket.emit('updateEmote', { name, image })
      })
      image = validUrl.isHttpsUri(image)
      if (!image) return this.sendMessage('Ist keine Elfe /pfräh')
      this.client.socket.emit('updateEmote', { name, image })
    },
    emote: function(user, params, meta) {
      if (!params.match(/^\/[\wäÄöÖüÜß]+$/) || !this.emotes.some(emote => emote.name == params)) return this.sendMessage('Ist kein emote')
      this.db.knex('emotescount')
      .where({ emote: params })
      .select('count', 'user')
      .then(result => {
        let count = 0
        let byuser = ''
        if (result.length > 0) {
          result = result.pop()
          count = result.count
          if (result.user) byuser = '. Zuletzt von: ' + result.user
        }
        this.sendMessage('Emote ' + params + ' wurde ' + count + ' mal pfostiert' + byuser)
      })
    },
    selbstsäge: function(user, params, meta) {
      const lastbyuser = this.playlist.filter(item => item.queueby === user && item.temp).pop()
      if (lastbyuser) this.mediaDelete(lastbyuser.uid)
    },
    help: function(user, params, meta) {
      this.sendByFilter('Verfügbare Befehle: ' + Object.keys(this.commands.handlers).join(', '))
    },
    hintergrund: logoHintergrund,
    logo: logoHintergrund,
    add: function(user, params, meta) {
      this.add(user, params, meta)
    },
    lauer: function(user, params, meta) {
      const siteurl = 'https://kohlchan.net/'
      const url = params.match(/^https:\/\/(?:www.)?kohlchan\.net\/(\w+)\/res\/(\d+)\.html(?:#(\d+))?/i)
      if (!url) return this.sendMessage('Lauere nur auf KC!')
      const board = url[1]
      const thread = url[2]
      const post = url[3] || thread
      console.log(url, board, thread, post)
      request({
        url: siteurl + board + '/res/' + thread + '.json',
        json: true
      }, (err, res, body) => {
        if (err || res.statusCode != 200) return console.error(err || body)
        const thread = body.posts.find(row => row.no == post)
        const getPic = thread => siteurl + board + '/src/' + thread.tim + thread.ext + '.pic'// + '/' + thread.filename + thread.ext + '.pic'
        if (!thread) return this.sendMessage('Pfosten nicht gefunden')
        let pics
        if (thread.tim) pics = getPic(thread)
        if (thread.extra_files) thread.extra_files.forEach(pic => pics += ' ' + getPic(pic))
        if (pics) this.sendMessage(pics)
        if (thread.com && !/ pics$/.test(params)) {
          let text = thread.com.replace(/href="\//g, 'href="' + siteurl).replace(/class="quote"/g, 'class="greentext"')
          this.sendByFilter(text, true)
        }
      })
    },
    wiki: function(user, params, meta) {
      request({
        url: 'https://de.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(params),
        json: true
      }, (err, res, body) => {
        if (err || res.statusCode != 200) return console.error(err || body)
        this.sendMessage(body.content_urls.desktop.page)
        this.sendByFilter('<div class="wikiinfo">' + (body.thumbnail ? `<img class="fikuimage" src="${body.thumbnail.source}" />` : '') + body.extract_html + '</div>', true)
      })
    },
    anmeldung: function(user, params, meta) {
      this.sendMessage(new Buffer('L2tpY2sK', "base64").toString() + user)
    },
    pic: function(user, params, meta) {
      const url = validUrl.isHttpsUri(params.split(' ').shift())
      if (!url) return this.sendMessage('Ist keine Elfe /pfräh')
      if (/https:\/\/(?:www\.)?instagram\.com\/p\/[\w-]+\/?/i.test(url)) request({
        url: url + '?__a=1',
        json: true
      }, (err, res, body) => {
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
        const image = body.graphql && body.graphql.shortcode_media && body.graphql.shortcode_media.display_url
        if (image) this.addLastImage(image).then(image => {
          this.sendMessage(image + '.pic')
        })
      })
    }
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
    rank = 3
  }
  else if (command === 'hintergrund') {
    css1 = 'body { background-image:url("'
    css2 = '"); }'
    message = 'Verfügbare Hintergründe: '
    options = {
      Partei: 'https://cdn.pbrd.co/images/HKadVnD.gif',
      Synthwave: 'https://i.imgur.com/JnSmM2r.jpg',
      Sternenhintergrund: 'https://tinyimg.io/i/Z48nCKm.gif',
      KinoX: 'https://tinyimg.io/i/4DUPI3z.jpg'
    }
    rank = 4
  }
  if (meta.rank < rank ) return this.sendMessage('Geht nur ab lvl' + rank)
  if (params) {
    if (params != 'last') {
      if (options.hasOwnProperty(params)) params = options[params]
      else {
        const emote = params.match(/^\/[\wäÄöÖüÜß]+/) && this.emotes.find(emote => emote.name == params)
        if (emote) params = emote.image
      }
      params = validUrl.isHttpsUri(params)
      if (params) cssReplace.call(this, command, css1 + params + css2)
    }
    else cssReplace.call(this, command)
  }
  else this.sendByFilter(message + Object.keys(options).join(', '))
}
