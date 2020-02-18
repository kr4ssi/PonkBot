/*!
**|   PonkBot add
**@
*/

'use strict';

const ProviderList = require('./add_provider.js')

const EventEmitter = require('events')
const path = require('path')
const URL = require('url')
const validUrl = require('valid-url')
const date = require('date-and-time')
const forwarded = require('forwarded');
const userscriptmeta = require('userscript-meta')
const crypto = require('crypto')
const { execFile } = require('child_process')

const toSource = source => require('js-beautify').js(require('tosource')(source), {
  indent_size: 2,
  keep_array_indentation: true
})

class Addition extends EventEmitter {
  constructor(...args) {
    super()
    this.matchUrl(...args)
    Object.assign(this, {
      //fileurl,
      //title,
      //duration,
      //quality,
      //thumbnail,
      //live,
      ffprobe: {},
      info: {},
      formats: [],
      //timestamp,
      //user: {},
      matchGroup: id => this.match[this.groups.indexOf(id) + 1]
    })
  }
  matchUrl(url, providerList) {
    if (providerList) {
      const provider = providerList.find(provider => {
        return !!(this.match = url.match(provider.regex))
      })
      if (!provider) throw new Error('Can\'t find a supported provider')
      Object.assign(this, provider, {
        getInfo: () => provider.getInfo.call(this, this.url),
        download: () => provider.download.call(this, this.url)
      })
    }
    return this.match
  }
  get url() {
    return this.match[0]
  }
  get id() {
    return this.type === 'cm' ? (this.bot.server.weblink + '/add.json?' + (this.needUserScript ? 'userscript&' : '') + 'url=' + this.url) : this.fileurl
  }
  get sources () {
    return (this.live && this.formats.length) ? this.formats : [{ height: 720, url: this.fileurl }]
  }
  get manifest() {
    return {
      title: this.title || this.url,
      live: this.live || false,
      duration: this.duration || 0,
      thumbnail: this.thumbnail,
      sources: this.sources.map(({ height: quality, url }) => ({
        url: this.needUserScript ? this.bot.server.weblink + '/redir?url=' + this.url : url.replace('http://', 'https://'),
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
        ].find(contentType => contentType.ext.includes(path.extname(URL.parse(this.fileurl).pathname))) || {}).type || 'video/mp4'
      }))
    }
  }
}

class AddCustom {
  constructor(ponk) {
    Object.assign(this, {
      cmAdditions : {},    // Custom Additions
      userLinks   : {},    // Userlinks for IP-Bound providers
      userScripts : {},    // Different userscripts
      bot         : ponk   // The bot
    })
    this.setupProviderList()
    this.bot.client.on('queue', ({ item }) => {
      if (item.queueby != this.bot.name) return
      this.cmAdditions[item.media.id] && this.cmAdditions[item.media.id].emit('queue')
    })
    this.bot.client.on('changeMedia', media => {
      this.cmAdditions[media.id] && this.cmAdditions[media.id].emit('play')
    })
    this.bot.client.on('queueFail', data => {
      this.bot.sendMessage(data.msg.replace(/&#39;/g,  `'`) + ' ' + data.link)
      if (data.msg === 'This item is already on the playlist') return this.bot.sendMessage('Das darf garnicht passieren')
      this.cmAdditions[data.id] && this.cmAdditions[data.id].emit('queueFail') && this.cmAdditions[data.id].removeAllListeners()
    })
    this.bot.client.prependListener('delete', ({ uid }) => {
      const id = this.bot.playlist.find(({ uid: vid }) => uid === vid).media.id
      this.cmAdditions[id] && this.cmAdditions[id].emit('delete') && this.cmAdditions[id].removeAllListeners()
    })
    this.bot.client.on('mediaUpdate', ({ currentTime }) => {
      this.cmAdditions[ponk.currMedia.id] && this.cmAdditions[ponk.currMedia.id].emit('mediaUpdate')
    })
  }
  async setupProviderList() {
    this.providerList = await new ProviderList(this.bot)
    const priority = ({ id, provider }) => provider.priority || provider.kinoxids[id]
    this.providerList.kinoxHosts = this.providerList.kinoxHosts.sort((a, b) =>  priority(a) - priority(b))
    this.supportedProviders = this.providerList.supportedProviders
    this.setupUserScript()
    this.setupServer()
  }
  setupUserScript() {
    const userscript = require('fs').readFileSync(path.join(__dirname, 'add.user.js'), {
      encoding: "utf-8"
    })
    const self = this
    const packageObj = require('../package.json')
    class UserScript {
      constructor(filename, descr = '', opt = {}, meta = {}) {
        Object.assign(this, {
          filename,
          descr,
          meta: userscriptmeta.stringify({
            name: packageObj.name + ' .add',
            namespace: packageObj.homepage,
            version: packageObj.version + '.1.0.7',
            author: packageObj.author,
            ...meta,
            include: self.providerList.userScriptIncludes.concat(meta.include || [])
          })
        })
        this.userscript = this.meta + '\nconst allowedHosts = '
        this.userscript += toSource(self.providerList.userScriptSources)
        this.userScript += '\n\nconst config = ' + toSource(Object.assign({
          weblink: self.bot.server.weblink,
        }, opt)) + userscript
      }
    }
    this.userScripts = [
      new UserScript('add.user'),
      new UserScript('add.dontask.user', 'Ohne Abfrage', {
        dontAsk: true
      }),
      new UserScript('add.new.user', 'Mit Channelberechtigung', {
        useGetValue: true
      }, {
        include: new RegExp('^https?:\\/\\/cytu\\.be\\/r\\/' + this.bot.client.chan),
        grant: [
          'GM_setValue', 'GM_getValue', 'unsafeWindow'
        ]
      }),
      new UserScript('add.auto.user', 'Experimentell', {
        useSendMessage: true,
        chan: this.bot.client.chan
      })
    ]

    const parseDate = userscriptts => date.format(new Date(parseInt(userscriptts)), 'DD.MM.YY');

    if (/localhost/.test(this.bot.server.weblink)) this.userscriptdate = parseDate(this.bot.started);
    else this.bot.db.getKeyValue('userscripthash').then(userscripthash => {
      const newuserscripthash = crypto.createHash('md5').update(JSON.stringify(this.userScripts)).digest('hex');
      if (userscripthash === newuserscripthash) return this.bot.db.getKeyValue('userscriptts').then(userscriptts => {
        this.userscriptdate = parseDate(userscriptts)
      });
      this.userscriptdate = parseDate(this.bot.started);
      this.bot.db.setKeyValue('userscriptts', this.bot.started);
      this.bot.db.setKeyValue('userscripthash', newuserscripthash);
      this.userScripts.forEach(({ filename, userscript }) => {
        this.bot.pushToGit(filename, userscript)
      })
    });

    this.userScriptPollOpts = [
      ...this.userScripts.map(({ filename, descr }) => this.bot.server.weblink + '/' + filename + '.js ' + descr)
    ]
  }

  fixurl(url) {
    if (typeof url === 'undefined') return false;
    url = decodeURIComponent(url).replace(/(?:^http:\/\/)/, 'https://');
    return validUrl.isHttpsUri(url);
  }

  setupServer() {
    const md5ip = req => crypto.createHash('md5').update(forwarded(req).pop()).digest('hex');

    const userlink = (req, res) => {
      const url = this.fixurl(req.query.url);
      if (!url) return res.send('invalid url');
      if (!req.query.userlink) return res.send('invalid userlink');
      if (!this.userLinks[url]) this.userLinks[url] = {};
      this.userLinks[url][md5ip(req)] = req.query.userlink;
      res.send(req.query.userlink + '<br>added to:<br><br>' + url);
    }

    this.bot.server.host.get('/userlink', userlink);

    this.bot.server.host.get('/add.json', (req, res) => {
      if (req.query.userlink) return userlink(req, res);
      const url = this.fixurl(req.query.url)
      if (!url) return res.send('invalid url');
      const cmManifest = this.cmAdditions[this.bot.server.weblink + '/add.json?' + (req.query.hasOwnProperty('userscript') ? 'userscript&' : '') + 'url=' + url];
      if (!cmManifest) return res.sendStatus(404);
      res.json(cmManifest.manifest);
    });

    this.bot.server.host.get('/redir', (req, res) => {
      const empty = 'https://ia801501.us.archive.org/0/items/youtube-yUUjeindT5U/VHS_simple_static_noise_-_Motion_background_loop_1-yUUjeindT5U.mp4';
      const url = this.fixurl(req.query.url);
      if (!url) return res.redirect(empty);
      const userLinks = this.userLinks[url];
      if (userLinks && userLinks[md5ip(req)]) res.redirect(userLinks[md5ip(req)]);
      else res.redirect(empty);
    });

    this.userScripts.forEach(({ filename, meta, userscript }) => {
      this.bot.server.host.get('/' + filename + '.js', (req, res) => {
        res.end(userscript);
      })
      this.bot.server.host.get('/' + filename + '.meta.js', (req, res) => {
        res.end(meta);
      })
    })
  }

  getDuration(addition) {
    let tries = 0
    const tryToGetDuration = err => {
      return new Promise((resolve, reject) => {
        if (err) {
          console.error(err)
          if (tries > 1) {
            this.bot.sendMessage('Can\'t get duration')
            return reject()
          }
        }
        tries++
        let params = ['-v', 'error', '-show_format', '-show_streams', '-icy', '0', '-print_format', 'json']
        if (addition.info.http_headers) {
          const headers = Object.entries(addition.info.http_headers).map(([key, value]) => key + ': ' + value).join('\r\n')
          params = [...params, '-headers', headers]
        }
        execFile('ffprobe', [...params, addition.fileurl], (err, stdout, stderr) => {
          if (err) return tryToGetDuration(err)
          console.log(stderr)
          let info
          try {
            info = JSON.parse(stdout)
          }
          catch(err) {
            return console.error(err)
          }
          addition.ffprobe = info
          if (info.format && info.format.duration) {
            addition.duration = parseFloat(info.format.duration)
            resolve(addition)
          }
          else return tryToGetDuration(info)
        })
      })
    }
    return tryToGetDuration()
  }

  add(url, title, meta) {
    new Addition(url, this.providerList).getInfo().then(async addition => {
      addition.on('message', msg => this.bot.sendMessage(msg))
      //if (!meta.fiku && addition.fikuonly) throw new Error('not addable')
      if (this.bot.playlist.some(item => item.media.id === addition.id)) return this.bot.sendMessage('Ist schon in der playlist')
      if (title) addition.title = title
      if (addition.type === 'cm' && !addition.duration) try {
        addition = await this.getDuration(addition)
      } catch (err) {
        throw err
      }
      this.cmAdditions[addition.id] = addition
      if (meta.onPlay && typeof meta.onPlay === 'function') addition.on('play', meta.onPlay)
      if (meta.onQueue && typeof meta.onQueue === 'function') addition.on('queue', meta.onQueue)
      if (addition.needUserScript) addition.on('queue', () => {
        let userScriptPollId
        const userScriptPoll = () => {
          this.bot.client.once('newPoll', poll => {
            userScriptPollId = poll.timestamp
          })
          this.bot.client.createPoll({
            title: addition.title,
            opts: [
              addition.url,
              'Geht nur mit Userscript (Letztes update: ' + this.userscriptdate + ') (ks*.user.js bitte löschen)',
              ...this.userScriptPollOpts
            ],
            obscured: false
          })
        }
        userScriptPoll()
        addition.once('delete', () => {
          if (this.bot.poll.timestamp === userScriptPollId) this.bot.client.closePoll()
        })
        addition.on('play', data => {
          if (!this.bot.pollactive || this.bot.poll.timestamp != userScriptPollId) userScriptPoll()
          this.bot.client.once('changeMedia', () => {
            if (this.bot.poll.timestamp === userScriptPollId) this.bot.client.closePoll()
          })
        })
      })
      this.bot.addNetzm(addition.id, meta.addnext, meta.user, addition.type, title || addition.title, addition.url)
    }).catch(err => {
      console.log(err)
      this.bot.sendByFilter('Kann ' + url + ' nicht addieren. Addierbare Hosts: ' + this.supportedProviders)
    })
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
        const provider = this.API.add.providerList.find(provider => provider.name.includes(title))
        if (provider) this.sendByFilter(JSON.stringify({
          ...provider,
          regex: provider.regex.source
        }))
        return
      }
      url = validUrl.isHttpsUri(url)
      if (!url) this.sendMessage('Ist keine https-Elfe /pfräh')
      if (title === 'download') {
        if (this.downloading) return this.sendMessage('ladiert schon 1')
        const provider = new Addition(url, this.API.add.providerList)
        this.downloading = true
        let progress
        let timer
        let message
        provider.download(url).on('message', msg => {
          if (msg === message) return
          message = msg
          if (!message.startsWith('[download]')) return this.sendMessage(message)
          progress = message
          if (!timer) timer = setInterval(() => this.sendPrivate(progress, user), 10000)
        }).on('close', () => {
          clearInterval(timer)
          this.downloading = false
        }).on('error', err => {
          clearInterval(timer)
          this.downloading = false
          console.error(err)
        })
      }
      else this.API.add.add(url, title, { user, ...meta })
    },
    readd(user, params, meta) {
      const url = validUrl.isHttpsUri(params)
      if (!url) return this.sendMessage('Ist keine https-Elfe /pfräh')
      this.API.add.add(url, this.currMedia.title, { user,
        ...meta,
        addnext: true,
        onQueue: () => {
          this.mediaDelete(this.currUID)
        },
        onPlay: () => {
          this.commands.handlers.settime(user, (this.currMedia.currentTime - 30).toString(), meta)
        }
      })
    }
  }
}
