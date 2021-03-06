/*!
**|   PonkBot add
**@
*/

'use strict';

const ProviderList = require('./add_provider.js')

const URL = require('url')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const validUrl = require('valid-url')
const date = require('date-and-time')
const forwarded = require('forwarded')
const EventEmitter = require('events')
const { execFile } = require('child_process')
const userscriptmeta = require('userscript-meta')
const toSource = source => require('js-beautify').js(require('tosource')(source), {
  indent_size: 2,
  keep_array_indentation: true
})
const parser = require('subtitles-parser')

class Addition extends EventEmitter {
  constructor(url, providerList, meta) {
    super()
    this.matchUrl(url, providerList)
    this.fileid = Date.now()
    Object.assign(this, {
      user: meta.user,
      addnext: meta.addnext,
      timestamp: 0,
      duration: 0,
      fileurl: '',
      title: '',
      thumbnail: '',
      live: false,
      ffprobe: {},
      info: {},
      formats: [],
      headers: {},
      matchGroup: id => this.match[this.groups.indexOf(id) + 1]
    }).on('message', msg => {
      this.bot.sendMessage(msg)
    }).on('progress', msg => {
      this.bot.sendPrivate(msg, this.user)
    })
  }
  get url() {
    return this.match[0].replace('http://', 'https://')
  }
  get id() {
    if (this.type === 'cu') {
      if (!this.added) return this.embed
      return 'cu:' + crypto.createHash("sha256").update(this.embed).digest("base64")
    }
    if (this.type != 'cm') return this.fileurl.replace(/(?:^http:\/\/)/i, 'https://')
    let id = `${this.bot.server.weblink}/add.json?`
    if (this.needUserScript) id += 'userscript&'
    return id += `url=${this.fileid}`
  }
  get embed() {
    return `<iframe src="${this.fileurl}"></iframe>`
  }
  get sources () {
    if (this.live && this.formats.length) return this.formats
    return [{ height: 720, url: this.fileurl }]
  }
  get manifest() {
    return {
      title: this.title || this.url,
      live: this.live || false,
      duration: this.duration || 0,
      thumbnail: this.thumbnail.replace(/(?:^http:\/\/)/i, 'https://') || undefined,
      sources: this.sources.map(({ height: quality, url }) => ({
        url: this.needUserScript ? `${this.bot.server.weblink}/redir?url=${this.fileid}` : url.replace(/(?:^http:\/\/)/i, 'https://'),
        quality,
        contentType: ([
          {type: 'video/mp4', ext: ['.mp4']},
          {type: 'video/webm', ext: ['.webm']},
          {type: 'application/x-mpegURL', ext: ['.m3u8']},
          {type: 'video/ogg', ext: ['.ogv']},
          {type: 'application/dash+xml', ext: ['.mpd']},
          {type: 'audio/aac', ext: ['.aac']},
          {type: 'audio/ogg', ext: ['.ogg']},
          {type: 'audio/mpeg', ext: ['.mp3', '.m4a']}
        ].find(contentType => {
          return contentType.ext.includes(path.extname(URL.parse(this.fileurl).pathname))
        }) || {}).type || 'video/mp4'
      }))
    }
  }
  matchUrl(url, providerList = this.bot.API.add.providerList) {
    if (!providerList) throw new Error('No providerlist found')
    const provider = providerList.find(provider => {
      return !!(this.match = url.match(provider.regex))
    })
    if (!provider) throw new Error('Can\'t find a supported provider')
    return Object.assign(this, provider, {
      getInfo: (...args) => provider.getInfo.call(this, this.url, ...args),
      download: (...args) => provider.download.call(this, this.url, ...args)
    })
  }
  getDuration() {
    let tries = 0
    const headers = Object.entries(this.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')
    const tryToGetDuration = () => new Promise((resolve, reject) => {
      execFile('ffprobe', [
        '-v', 'error',
        '-show_format',
        '-show_streams',
        '-icy', '0',
        '-print_format', 'json'
      ].concat(headers ? ['-headers', headers] : [], this.fileurl), (err, stdout) => {
        if (err) return reject(err)
        resolve(stdout)
      })
    }).then(stdout => JSON.parse(stdout)).then(info => {
      if (!info.format) throw new Error(info)
      this.ffprobe = info
      if (info.format.duration) this.duration = parseFloat(info.format.duration)
      else this.live = true
      return this
    }).catch(err => {
      console.error(err)
      if (++tries > 1) throw err
      return tryToGetDuration()
    })
    return tryToGetDuration()
  }
  add(next = this.addnext) {
    if (this.needUserScript || this.infopoll) this.on('queue', () => {
      const userScriptPoll = () => {
        this.bot.client.once('newPoll', poll => {
          this.userScriptPollId = poll.timestamp
        })
        this.bot.client.createPoll({
          title: this.title || this.url,
          opts: this.infopoll || [
            this.url + '#userscript'+ this.fileid,
            `Geht nur mit Userscript (Letztes update: ${this.bot.API.add.userscriptdate})`,
            '(ks*.user.js bitte löschen)',
            ...this.bot.API.add.userScriptPollOpts
          ],
          obscured: false
        })
        this.once('delete', () => {
          if (this.bot.poll.timestamp === this.userScriptPollId)
          this.bot.client.closePoll()
        })
      }
      userScriptPoll()
      this.on('play', data => {
        if (!this.bot.pollactive) userScriptPoll()
        if (this.bot.poll.timestamp != this.userScriptPollId)
        userScriptPoll()
        this.bot.client.once('changeMedia', () => {
          if (this.bot.poll.timestamp === this.userScriptPollId)
          this.bot.client.closePoll()
        })
      })
    })
    this.bot.client.socket.emit('queue', {
      title: this.title || this.url,
      type : this.type,
      id : this.id,
      pos : next ? 'next' : 'end',
      temp : true,
    })
    this.emit('add')
    this.added = true
    return this.bot.API.add.cmAdditions[this.id] = this
  }
}

class AddCustom {
  constructor(ponk) {
    Object.assign(this, {
      cmAdditions : {},    // Custom Additions
      userLinks   : {},    // Userlinks for IP-Bound providers
      userScripts : [],    // Different userscripts
      limit       : [],    // Download-limits per user
      captchas    : [],    // Captchas
      bot         : ponk   // The bot
    })
    this.setupProviderList()
    this.bot.client.on('queue', ({ item: { queueby, media: { id, seconds } } }) => {
      if (queueby != this.bot.name) return
      if (this.cmAdditions[id]) Object.assign(this.cmAdditions[id], {
        duration: seconds,
        closetoend: seconds * 0.8
      }).emit('queue')
    })
    this.bot.client.on('changeMedia', ({ id }) => {
      if (this.cmAdditions[id]) this.cmAdditions[id].emit('play')
    })
    this.bot.client.on('queueFail', ({ msg, link, id }) => {
      this.bot.sendMessage(msg.replace(/&#39;/g,  `'`) + ' ' + link)
      if (msg === 'This item is already on the playlist')
      return this.bot.sendMessage('Das darf garnicht passieren')
      if (this.cmAdditions[id]) {
        if (link === 'https://youtu.be/' + id) {
          if (/^(?:The uploader has made this video non-embeddable)|(?:Cannot add age restricted videos.)/.test(msg))
          return this.cmAdditions[id].download().then(() => {
            this.bot.sendMessage(this.cmAdditions[id].fileurl + ' wird addiert')
            this.cmAdditions[id].add()
          })
          this.cmAdditions[id].emit('queueFail')
          //this.cmAdditions[id].removeAllListeners()
        }
      }
    })
    this.bot.client.prependListener('delete', ({ uid }) => {
      const id = this.bot.playlist.find(({ uid: vid }) => uid === vid).media.id
      if (this.cmAdditions[id]) {
        this.cmAdditions[id].emit('delete')
        this.cmAdditions[id].removeAllListeners()
      }
    })
    this.bot.client.on('mediaUpdate', ({ currentTime }) => {
      if (this.srt && this.srt.length) {
        while (currentTime * 1000 > this.srt[0].startTime)
        this.bot.sendMessage(this.srt.shift().text)
      }
      if (this.cmAdditions[ponk.currMedia.id]) {
        if (currentTime > this.cmAdditions[ponk.currMedia.id].closetoend) {
          if (!this.cmAdditions[ponk.currMedia.id].closetoended) {
            this.cmAdditions[ponk.currMedia.id].closetoended = true
            this.cmAdditions[ponk.currMedia.id].emit('closetoend')
          }
        }
        this.cmAdditions[ponk.currMedia.id].emit('update')
      }
    })
  }
  async setupProviderList() {
    this.providerList = await new ProviderList(this.bot).then(undefined, console.error)
    this.supportedProviders = this.providerList.supportedProviders
    this.setupUserScript()
    this.setupServer()
  }
  setupUserScript() {
    const userscript = fs.readFileSync(path.join(__dirname, 'add.user.js'))
    const self = this
    const packageObj = require('../package.json')
    const channelregex = new RegExp(/(?:^https?:\/\/cytu\.be\/r\/)/.source + self.bot.channel)
    class UserScript {
      constructor(filename, descr = '', opt = {}, meta = {}, includes = []) {
        Object.assign(this, {
          filename,
          descr,
          meta: userscriptmeta.stringify({
            name: packageObj.name + ' .add',
            namespace: packageObj.homepage,
            version: packageObj.version + '.1.0.7',
            author: packageObj.author,
            ...meta,
            include: self.providerList.userScriptIncludes.concat(includes.regex || includes.map(include => include.regex))
          })
        })
        this.userscript = this.meta + '\nconst includes = '
        this.userscript += toSource(self.providerList.userScriptSources.concat(includes))
        this.userscript += '\n\nconst config = ' + toSource(Object.assign({
          weblink: self.bot.server.weblink,
        }, opt)) + '\n\n' + userscript
      }
    }
    this.userScripts = [
      new UserScript('add.user'),
      new UserScript('add.new.user', 'Mit Channelberechtigung', {
        useGetValue: true
      }, {
        grant: [
          'GM_setValue', 'GM_getValue', 'unsafeWindow'
        ]
      }, {
        regex: channelregex,
        groups: [],
        active: true,
        init: function() {
          if (!this.useGetValue) return
          const matchLinkRegEx = new RegExp('^' + this.weblink.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&') +
          /\/add\.json\?userscript&url=(.*)/.source)
          const socket = (unsafeWindow || window).socket
          if (!socket) return false
          if (typeof socket.on !== 'function') return false
          clearInterval(initTimer)
          let srcTimer
          socket.on('changeMedia', ({ id }) => {
            clearInterval(srcTimer)
            const match = id.match(matchLinkRegEx)
            if (!match) return
            const url = match[1]
            if (!includes.find(include => include.regex.test(url))) return
            console.log(match)
            srcTimer = setInterval(() => {
              const e = document.getElementById('ytapiplayer_html5_api')
              console.log(e)
              if (!e) return
              clearInterval(srcTimer)
              e.src = GM_getValue(url)
            }, 1000)
          })
        }
      }),
      new UserScript('add.doask.user', 'Mit Abfrage', {
        doAsk: true
      }),
      new UserScript('add.auto.user', 'Experimentell', {
        postMessage: true,
        chan: this.bot.channel
      })
    ]
    const parseDate = userscriptts => date.format(new Date(parseInt(userscriptts)), 'DD.MM.YY')
    if (/localhost/.test(this.bot.server.weblink)) this.userscriptdate = parseDate(this.bot.started)
    else this.bot.db.getKeyValue('userscripthash').then(userscripthash => {
      const newuserscripthash = crypto.createHash('md5').update(JSON.stringify(this.userScripts)).digest('hex')
      if (userscripthash === newuserscripthash)
      return this.bot.db.getKeyValue('userscriptts').then(userscriptts => {
        this.userscriptdate = parseDate(userscriptts)
      })
      this.userscriptdate = parseDate(this.bot.started)
      this.bot.db.setKeyValue('userscriptts', this.bot.started)
      this.bot.db.setKeyValue('userscripthash', newuserscripthash)
      this.userScripts.forEach(({ filename, userscript }) => {
        this.bot.API.emotes.pushToGit(filename + '.js', userscript)
      })
    })
    this.userScriptPollOpts = [
      ...this.userScripts.map(({ filename, descr }) => this.bot.server.weblink + '/' + filename + '.js ' + descr)
    ]
  }

  fixurl(url) {
    if (typeof url === 'undefined') return false;
    url = decodeURIComponent(url).replace(/(?:^http:\/\/)/, 'https://')
    return validUrl.isHttpsUri(url)
  }

  setupServer() {
    const md5ip = req => crypto.createHash('md5').update(forwarded(req).pop()).digest('hex')
    const userlink = (req, res) => {
      //const url = this.fixurl(req.query.url)
      //if (!url) return res.send('invalid url')
      const url = req.query.url
      if (!req.query.userlink) return res.send('invalid userlink')
      if (!this.userLinks[url]) this.userLinks[url] = {}
      this.userLinks[url][md5ip(req)] = req.query.userlink
      res.send(req.query.userlink + '<br>added to:<br><br>' + this.userLinks[url].url)
    }
    this.bot.server.host.get('/userlink', userlink)
    this.bot.server.host.get('/add.json', (req, res) => {
      if (req.query.userlink) return userlink(req, res)
      const url = req.query.url
      const cmManifest = this.cmAdditions[this.bot.server.weblink + '/add.json?' + (req.query.hasOwnProperty('userscript') ? 'userscript&' : '') + 'url=' + url]
      if (!cmManifest) return res.sendStatus(404)
      res.json(cmManifest.manifest)
    })
    this.bot.server.host.get('/redir', (req, res) => {
      const empty = 'https://ia801501.us.archive.org/0/items/youtube-yUUjeindT5U/VHS_simple_static_noise_-_Motion_background_loop_1-yUUjeindT5U.mp4'
      //const url = this.fixurl(req.query.url)
      //if (!url) return res.redirect(empty)
      const url = req.query.url
      const userLinks = this.userLinks[url]
      if (userLinks && userLinks[md5ip(req)]) res.redirect(userLinks[md5ip(req)])
      else res.redirect(empty)
    })
    this.userScripts.forEach(({ filename, meta, userscript }) => {
      this.bot.server.host.get('/' + filename + '.js', (req, res) => {
        res.end(userscript)
      })
      this.bot.server.host.get('/' + filename + '.meta.js', (req, res) => {
        res.end(meta)
      })
    })
  }

  add(url, title, meta) {
    const addition = new Addition(url, this.providerList, meta)
    if (meta.gettitle) addition.gettitle = true
    else addition.getInfo().then(() => {
      //addition.emit('info', addition)
      if (!meta.fiku && addition.fikuonly)
      throw `Kein Hoster gefunden. Addierbare Hosts: ${this.supportedProviders}`
      if (this.bot.playlist.some(item => item.media.id === addition.id))
      throw 'Ist schon in der playlist'
      if (title) addition.title = title
      if (addition.type === 'cm' && !addition.live && !addition.duration)
      return addition.getDuration()
    }).then(() => {
      addition.add(meta.addnext)
    }).catch(err => {
      console.error(err)
      this.bot.sendByFilter(err.message || err)
    })
    return addition
  }

  download(url, title, meta) {
    if (this.downloading) return this.bot.sendMessage('ladiert schon 1')
    this.limit = this.limit.filter(({ date }) => {
      return date > (Date.now() - (12 * 60 * 60 * 1000))
    })
    if (this.bot.getUserRank(meta.user) < 4 && this.limit.reduce((acc, limit) => {
      if (limit.user === meta.user) acc += limit.size
      return acc
    }, 0) > 536870912) return this.bot.sendMessage('zuviel ladiert')
    const addition = new Addition(url, this.providerList, meta)
    this.downloading = true
    addition.download().then(stream => {
      this.bot.sendMessage(addition.fileurl + ' wird addiert')
      if (title) addition.title = title
      addition.add(meta.addnext)
      stream.on('close', async () => {
        this.downloading = false
        if (!addition.size) {
          addition.size = await fs.promises.stat(path.join(this.bot.API.keys.filepath, addition.filename)).size
        }
        this.limit.push({
          user: meta.user,
          size: addition.size,
          date: Date.now()
        })
      }).on('error', err => {
        this.downloading = false
        this.bot.sendMessage(err.message || err)
      })
    }).catch(console.error)
    return addition
  }
}

module.exports = {
  meta: {
    active: true,
    type: 'giggle'
  },
  giggle(ponk){
    return new Promise((resolve, reject) => {
      ponk.API.add = new AddCustom(ponk);
      ponk.logger.log('Registering custom .add');
      resolve();
    })
  },
  handlers: {
    add(user, params, meta) {
      const split = params.split(' ')
      let url = split.shift()
      let title = split.join(' ').trim()
      if (url === 'regex') {
        const provider = this.API.add.providerList.byName(title)
        if (provider) this.sendByFilter(provider.overview, true)
        return
      }
      url = validUrl.isHttpsUri(url)
      if (!url) return this.sendMessage('Ist keine https-Elfe /pfräh')
      else this.API.add.add(url, title, { user, ...meta })
    },
    readd(user, params, meta) {
      const url = validUrl.isHttpsUri(params)
      if (!url) return this.sendMessage('Ist keine https-Elfe /pfräh')
      this.API.add.add(url, this.currMedia.title, {
        ...meta,
        user,
        addnext: true,
      }).on('queue', () => {
        this.mediaDelete(this.currUID)
      }).on('play', () => {
        const jumpto = (this.currMedia.currentTime - 30)
        this.commands.handlers.settime(user, jumpto.toString(), meta)
      })
    },
    download(user, params, meta) {
      const split = params.split(' ')
      let url = split.shift()
      let title = split.join(' ').trim()
      if (url) {
        url = validUrl.isHttpsUri(url)
        if (!url) return this.sendMessage('Ist keine https-Elfe /pfräh')
        this.API.add.download(url, title, { user, ...meta })
      }
      else if (this.currMedia.type === 'yt') {
        url = 'https://youtu.be/' + this.currMedia.id
        this.API.add.download(url, this.currMedia.title, {
          ...meta,
          user,
          addnext: true
        }).on('queue', () => {
          this.mediaDelete(this.currUID)
        })
      }
    },
    sub(user, params, meta) {
      if (params === 'off') return this.API.add.srt = []
      const url = validUrl.isHttpsUri(params)
      if (!url) return this.sendMessage('Ist keine https-Elfe /pfräh')
      this.fetch(url).then(({ body }) => {
        const srt = parser.fromSrt(body, true)
        this.API.add.srt = srt.filter(srt => srt.startTime > this.currMedia.currentTime * 1000)
      })
    },
    userscripts(user, params, meta) {
      this.sendByFilter(this.API.add.userScriptPollOpts.join('\n'))
    }
  }
}
