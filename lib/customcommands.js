/*!
**|   PonkBot Custom Commands
**@
*/

'use strict';

const validUrl = require('valid-url')

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
let pr0=''
const imageHtml = (image, link) => '<a class="bild" href="' + (link || image) + '" target="_blank"><img class="image-embed-small" src="' + image + '" /></a>'

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
    giphy: function(user, params, meta) {
      this.fetch('https://api.giphy.com/v1/gifs/search', {
        qs: {
          api_key: this.API.keys.giphy,
          q: params,
          limit: 5
        }, json: true,
        getlist: 'data',
        getrandom: true
      }).then(body => this.addLastImage(body.images.fixed_height.url).then(image => {
        this.sendMessage(image + '.pic')
      }))
    },
    tenor: function(user, params, meta) {
      this.fetch('https://api.tenor.com/v1/search', {
        qs: {
          api_key: this.API.keys.tenor,
          tag: params,
          limit: 5
        }, json: true,
        getlist: 'results',
        getrandom: true
      }).then(body => this.addLastImage(body.media[0].gif.url).then(image => {
        this.sendMessage(image + '.pic')
      }))
    },
    w0bm: function(user, params, meta) {
      const getW0bm = (page = '') => {
        this.fetch('https://w0bm.com/index', {
          qs: {
            q: params,
            page
          }, json: false
        }).then(body => {
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
          this.sendByFilter(imageHtml('https://w0bm.com/thumbs/' + w0bm + '.gif', 'https://b.w0bm.com/' + w0bm + '.webm'), true)
        })
      }
      if (params.length > 0) return getW0bm()
      if (!w0bm) return [...Array(meta.repeat)].forEach((c, i) => this.fetch('https://w0bm.com/api/video/random', {
        json: true
      }).then(body => {
        this.addNetzm('https://b.w0bm.com/' + body.file, meta.addnext, user)
        if (meta.repeat === 1) this.sendMessage('Zufälliges netzm von w0bm.com addiert')
        else if (meta.repeat === i + 1) this.sendMessage(meta.repeat + ' zufällige netzms von w0bm.com addiert')
      }))
      this.addNetzm('https://b.w0bm.com/' + w0bm + '.webm', meta.addnext, user)
      this.sendMessage('Letztes gif als netzm addiert')
      w0bm = false
    },
    pr0: function(user, params, meta) {
      let video = false
      params = params.replace(/(?:^| )video(?: |$)/, () => ((video = true) && '')).trim()
      if (params.length < 1 && pr0) {
        this.addNetzm('https://img.pr0gramm.com/' + pr0, meta.addnext, user)
        this.sendMessage('Letzter Daumennagel als Video addiert')
        pr0 = false
      }
      else this.fetch('https://pr0gramm.com/api/items/get', {
        qs: {
          tags: '!' + (!video ? '-' : '') + 'video ' + params,
        }, json: true,
        getlist: 'items'
      }).then(body => {
        let item = body[Math.floor(Math.random() * body.length)]
        if (!video) return this.addLastImage('https://img.pr0gramm.com/' + item.image).then(image => {
          this.sendMessage(image + '.pic')
        })
        if (params.length < 1) return [...Array(meta.repeat)].forEach((c, i) => {
          item = body[Math.floor(Math.random() * body.length)]
          this.addNetzm('https://img.pr0gramm.com/' + item.image, meta.addnext, user)
          if (meta.repeat === 1) this.sendMessage('Zufälliges Video von pr0gramm.com addiert')
          else if (meta.repeat === i + 1) this.sendMessage(meta.repeat + ' zufällige Videos von pr0gramm.com addiert')
        })
        pr0 = item.image
        this.sendByFilter(imageHtml('https://thumb.pr0gramm.com/' + item.thumb, 'https://img.pr0gramm.com/' + item.image), true)
      })
    },
    netzm: function(user, params, meta) {
      const netzms = []
      const getNetzm = (faeden, initial) => {
        const faden = faeden.pop()
        this.fetch(faden, {
          json: false,
          customerr: [404]
        }).then(body => {
          if (body === 404) return this.db.knex('netzms').where({ faden }).del().then(() => {
            this.sendMessage('Faden ' + faden + ' 404ed')
            if (faeden.length) getNetzm(faeden)
          })
          const regMatch = body.match(/(\/\w+\/src\/[0-9-]+\.(mp4|flv|webm|og[gv]|mp3|mov|m4a)\/[\w- ]+\.(mp4|flv|webm|og[gv]|mp3|mov|m4a))/g)
          if (!regMatch) return this.db.knex('netzms').where({faden}).del().then(() => {
            this.sendMessage('Keine netzms in ' + faden + ' gefunden')
            if (faeden.length) getNetzm(faeden)
          })
          const addNetzm = () => {
            netzms.push.apply(netzms, regMatch.map(item => ({ item, faden })));
            if (faeden.length) return getNetzm(faeden)
            let added = {};
            [...Array(meta.repeat)].forEach((c, i) => {
              const netzm = netzms[Math.floor(Math.random() * netzms.length)]
              this.addNetzm('https://kohlchan.net' + netzm.item, meta.addnext, user)
              if (!added[netzm.faden]) added[netzm.faden] = 1
              else added[netzm.faden]++
            })
            Object.keys(added).forEach(faden => {
              const count = added[faden]
              if (count > 1) this.sendMessage(count + ' zufällige netzms aus ' + faden + ' addiert')
              else this.sendMessage('Zufälliges netzm aus ' + faden + ' addiert')
            })
          }
          if (initial) return this.db.knex('netzms').insert({ faden }).then(() => {
            this.sendMessage(faden + ' ' + regMatch.length + ' netzms ladiert')
            addNetzm()
          })
          addNetzm()
        })
      }
      if (params.match(/^https:\/\/(www.)?kohlchan\.net/i)) return this.db.knex('netzms').where({ faden: params }).then(result => {
        if (result.length < 1) return getNetzm([params], true)
        getNetzm([params])
      })
      this.db.knex('netzms').select('faden').then(result => {
        if (result.length < 1) return this.sendMessage('Kein Faden ladiert')
        getNetzm(result.map(row => row.faden))
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
      }).then(() => this.client.socket.emit('setChannelCSS', {
        css: this.channelCSS.replace(/\/emotes\.css\?[^"]+/, '/emotes.css?' + Math.random().toString(36).slice(2))
      }))
    },
    selbstsäge: function(user, params, meta) {
      const lastbyuser = this.playlist.filter(item => item.queueby === user && item.temp).pop()
      if (lastbyuser) this.mediaDelete(lastbyuser.uid)
    },
    hintergrund: logoHintergrund,
    logo: logoHintergrund,
    add: function(user, params, meta) {
      const split = params.split(' ')
      let url = split.shift()
      let title = split.join(' ').trim()
      url = validUrl.isHttpsUri(url)
      if (url) this.add(url, title, { user, willkür: meta.addnext })
      else this.sendMessage('Ist keine https-Elfe /pfräh')
    },
    lauer: function(user, params, meta) {
      const siteurl = 'https://kohlchan.net'
      const url = params.match(/^https:\/\/(?:www.)?kohlchan\.net\/(\w+)\/res\/(\d+)\.html(?:#q?(\d+))?/i)
      if (!url) return this.sendMessage('Lauere nur auf KC!')
      const board = url[1]
      const thread = url[2]
      const postid = url[3] || thread
      this.fetch(siteurl + '/' + board + '/res/' + thread + '.json', {
        json: true
      }).then(body => {
        let post
        if (postid == body.threadId) post = body
        else post = body.posts.find(posts => posts.postId == postid)
        const getPic = post => {
          const file = post.path
          let thumb = post.thumb
          if (post.mime === 'image/gif') thumb = file
          //else if (/^\.(?:jpe?g|gif|png|bmp)$/.test(post.ext)) thumb += '.png'
          //else if (/^\.(?:mp4|webm)$/.test(post.ext)) thumb += '.jpg'
          //else if (/^\.(?:mp3|ogg|flac|opus)$/.test(post.ext)) thumb = 'static/audio.png'
          //else if (/^\.(?:7z|zip)$/.test(post.ext)) thumb = 'static/zip.png'
          //else thumb = 'static/file.png'
          //if (/^\.(?:mp4|flv|webm|og[gv]|mp3|mov|m4a)/.test(post.ext)) /überlege
          return imageHtml(siteurl + thumb, siteurl + file)
        }
        if (!post) return this.sendMessage('Pfosten nicht gefunden')
        let pics = ''
        post.files.forEach(pic => pics += ' ' + getPic(pic))
        if (post.subject && !/ pics$/.test(params)) this.sendByFilter('<span class="lauersubject">' + post.subject + '<span>', true)
        if (pics.length > 0) this.sendByFilter(pics, true)
        if (post.message && !/ pics$/.test(params)) {
          let text = post.message.replace(/class="quote"/g, 'class="greentext"').replace(/>>(\d+)/, '<a href="' +  siteurl + '/' + board + '/res/' + thread + '.html#' + '$1' + '" target="_blank" rel="noopener noreferrer">' + '>>$1' + '</a>')
          this.sendByFilter(text, true)
        }
      })
    },
    wiki: function(user, params, meta) {
      this.fetch('https://de.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(params), {
        json: true,
        customerr: [404]
      }).then(body => {
        if (body === 404) return this.sendMessage('Keine Ergebnisse /elo')
        this.sendMessage(body.content_urls.desktop.page)
        this.sendByFilter('<div class="wikiinfo">' + (body.thumbnail ? `<img class="fikuimage" src="${body.thumbnail.source}" />` : '') + body.extract_html + '</div>', true)
      })
    },
    pic: function(user, params, meta) {
      const url = validUrl.isHttpsUri(params.split(' ').shift())
      if (!url) return this.sendMessage('Ist keine https-Elfe /pfräh')
      if (/https:\/\/(?:www\.)?instagram\.com\/p\/[\w-]+\/?/i.test(url)) this.fetch(url + '?__a=1', {
        json: true
      }).then(body => {
        const image = body.graphql && body.graphql.shortcode_media && body.graphql.shortcode_media.display_url
        if (image) this.addLastImage(image).then(image => {
          this.sendMessage(image + '.pic')
        })
      })
    },
    anagramde: function(user, params, meta) {
      const text = params.toLowerCase().trim()
      if (text.length > 17) this.sendMessage('Nur 17 Zeichen /elo')
      this.fetch('http://www.sibiller.de/anagramme/cgi-bin/CallWP.cgi', {
        method: 'post',
        form: {
          text,
          anz: 5,
          max: 12,
          min: 2,
          typ: 1
        }, json: false
      }).then(body => {
        let regMatch = body.match(/     1\.  ([^\n]+)/i)
        if (!regMatch) return this.sendMessage('Keine Ergebnisse /elo')
        let anagram = regMatch[1].toLowerCase()
        if (anagram === text) {
          regMatch = body.match(/     2\.  ([^\n]+)/i)
          if (!regMatch) return this.sendMessage('Keine Ergebnisse /elo')
          anagram = regMatch[1].toLowerCase()
        }
        this.sendMessage(anagram.charAt(0).toUpperCase() + anagram.slice(1))
      })
    },
    waskochen: function(user, params, meta) {
      params = params.replace(/;/g, ',').split(',').map(param => param.trim()).join(',')
      .replace(/ö/g, 'o')
      .replace(/ä/g, 'a')
      .replace(/ü/g, 'u')
      .replace(/ß/g, 'ss')
      this.fetch('https://serve.restegourmet.de/search/', {
        method: 'post',
        json: {
          request_doc: {
            rg_wp_url: '/rezeptsuche/_/' + params + '/_/'
          }
        },
        getprop: 'recipes',
        getlist: 'items',
        getrandom: true
      }).then(body => {
        body = body._source
        this.sendMessage(body.url)
        this.sendByFilter('<div class="wikiinfo">' + ((body.images && body.images[0].url_external) ? `<img class="fikuimage" src="${body.images[0].url_external}" />` : '') +
        'Zutaten: ' + body.ingredients.map(row => row.name).join(', ') + '<br><br>' + 'Tags: ' + body.tags_channelized.join(', ')  + '</div>', true)
      })
    },
    help: function(user, params, meta) {
      if (this.commands.helpdata.hasOwnProperty(params)) this.sendByFilter(this.commands.helpdata[params].synop +
        (params === 'add' ? this.allowedHosts() : '') +
        (this.commands.helpdata[params].rank > 1 ? '. Geht ab Level: ' + this.commands.helpdata[params].rank :
        (this.commands.helpdata[params].rank === 1 ? '. Geht für für registrierte User' : '')))
        else this.sendByFilter('Verfügbare Befehle: ' + Object.keys(this.commands.handlers).join(', '))
      }
    },
    helpdata: require('./help.js')
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
        Sternenhintergrund: 'https://tinyimg.io/i/Z48nCKm.gif',
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
