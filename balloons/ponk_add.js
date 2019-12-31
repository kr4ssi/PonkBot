/*!
**|   PonkBot add
**@
*/

'use strict';

const CyTubeClient = require('../lib/client.js');

const HosterList = require('./add_hosts.js')

const validUrl = require('valid-url')
const date = require('date-and-time')
const forwarded = require('forwarded');
const userscriptmeta = require('userscript-meta')

const EventEmitter = require('events');
const crypto = require('crypto')
const { execFile } = require('child_process')
const { PythonShell } = require('python-shell')

const toSource = source => require('js-beautify').js(require('tosource')(source), {
  indent_size: 2,
  keep_array_indentation: true
})

class AddCustom {
  constructor(ponk) {
    Object.assign(this, {
      //userMedia   : [],    // A list of added media
      cmManifests : {},    // Custom-json-manifests
      userLinks   : {},    // Userlinks for IP-Bound hosters
      userScripts : {},    // Different userscripts
      bot         : ponk   // The bot
    })
    PythonShell.run('./youtube-dl_get-regex.py', {
      parser: data => {
        let [name, regex, groups] = JSON.parse(data)
        regex = new RegExp(regex.replace(/^(?:\(\?\w+\))/, '').replace(/(?:\(\?P\<(\w+)\>)|(?:\(\?\((\w+)\))|(?:\(\?P=(\w+)\))/g, (match, p1, p2, p3) => {
          if (p1) {
            groups.push(p1)
            return '('
          }
          const p = p2 || p3
          if (p && !groups.includes(p) && !Number(p)) throw new Error('error')
          groups.push(p)
          return p2 ? '(' : ''
        }))
        return { [name]: { regex, groups } }
      }
    }, (err, result) => {
      if (err) throw err.message
      this.allowedHosts = new HosterList(ponk, Object.assign(...result))
      this.allowedHostsString = this.allowedHosts.allowedHostsString
      this.setupUserScript();
      this.setupServer();
      this.setupMediathek();
      this.setupCCCManifests();
    });
    this.play = new EventEmitter()
    this.del = new EventEmitter()
    this.queue = new EventEmitter()
    this.bot.client.on('queue', ({ item: { media } }) => {
      this.queue.emit(media.id, media)
    })
    this.bot.client.on('changeMedia', data => {
      this.play.emit(data.id, data)
    })
    this.bot.client.on('queueFail', data => {
      this.bot.sendMessage(data.msg.replace(/&#39;/g,  `'`) + ' ' + data.link)
      if (data.msg === 'This item is already on the playlist') return this.bot.sendMessage('Das darf garnicht passieren')
      this.del.emit(data.id)
      this.del.removeAllListeners(data.id)
      this.play.removeAllListeners(data.id)
      this.queue.removeAllListeners(data.id)
    });
    const handleVideoDelete = this.bot.handleVideoDelete
    this.bot.handleVideoDelete = ({ uid }) => {
      const id = this.bot.playlist.find(({ uid: vid }) => uid === vid).media.id
      this.del.emit(id)
      this.del.removeAllListeners(id)
      this.play.removeAllListeners(id)
      this.queue.removeAllListeners(id)
      handleVideoDelete.call(this.bot, { uid })
    }
  }

  setupMediathek() {
    this.gezmanifests = []
    this.bot.fetch('https://www.ardmediathek.de/ard/live/Y3JpZDovL2Rhc2Vyc3RlLmRlL0xpdmVzdHJlYW0tRGFzRXJzdGU', {
      $: true
    }).then(({ $ }) => {
      return Promise.all($('.button._focusable').filter((i, e) => /devicetype=pc/.test(e.attribs.href)).map((i, e) => {
        return this.allowedHosts.hostAllowed('https://www.ardmediathek.de' + e.attribs.href).then(host => {
          return host.getInfo()
        }).then(result => ({
          ...result,
          sources: [360, 480, 540, 720, 1080].map(quality => ({
            url: ((result.info.formats.find(format => {
              if (/hr/.test(e.attribs.title)) {
                if (/sub/.test(format.url)) return
              }
              else if (format.manifest_url != result.info.manifest_url) return
              return format.height === quality
            })||{}).url||'').replace('http://', 'https://'),
            contentType: 'application/x-mpegURL',
            quality
          })).filter(e => !!e.url),
          title: e.attribs.title
        }))
      }).toArray().concat([
        'https://www.zdf.de/sender/zdf/zdf-live-beitrag-100.html',
        'https://www.zdf.de/sender/zdfneo/zdfneo-live-beitrag-100.html',
        'https://www.zdf.de/dokumentation/zdfinfo-doku/zdfinfo-live-beitrag-100.html'
      ].map(url => this.allowedHosts.hostAllowed(url).then(host => {
        return host.getInfo()
      }).then(result => ({
        ...result,
        sources: [360, 480, 540, 720, 1080].map(quality => ({
          url: ((result.info.formats.find(format => {
            return format.height === quality
          })||{}).url||'').replace('http://', 'https://'),
          contentType: 'application/x-mpegURL',
          quality
        })).filter(e => !!e.url),
        title: result.info.title.replace(' Livestream', '')
      }))))).then(results => results.forEach(({ info, title, sources }) => {
        this.bot.server.host.get('/mediathek/' + encodeURIComponent(title) + '.json', (req, res) => {
          res.json({
            title,
            live: true,
            duration: 0,
            sources
          })
        })
        this.gezmanifests.push({
          title,
          id: this.bot.server.weblink + '/mediathek/' + encodeURIComponent(title) + '.json'
        })
      }))
    })
  }

  setupUserScript() {
    const userscript = require('fs').readFileSync('ks.user.js', {
      encoding: "utf-8"
    }).match(/\B(\/\/ ==UserScript==\r?\n(?:[\S\s]*?)\r?\n\/\/ ==\/UserScript==)\r?\n\r?\nconst allowedHosts[^\n\r]+\r?\n\r?\nconst config[^\n\r]+(\r?\n[\S\s]*)/);
    if (!userscript) throw new Error('Userscript broken');
    const weblink = this.bot.server.weblink
    const allowedHosts = this.allowedHosts
    const allowedHostsSource = toSource(allowedHosts.userScripts.allowedHostsSource)
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
            include: allowedHosts.userScripts.includes.concat(meta.include || [])
          })
        })
        const hosts = '\nconst allowedHosts = ' + allowedHostsSource
        const config = '\n\nconst config = ' + toSource(Object.assign({
          weblink,
        }, opt))
        this.userscript = this.meta + hosts + config + userscript[2]
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
    url = decodeURIComponent(url).replace(/^http:\/\//i, 'https://');
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
      const cmManifest = this.cmManifests[url];
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

  getDuration(host) {
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
        if (host.info.http_headers) {
          const headers = Object.entries(host.info.http_headers).map(([key, value]) => key + ': ' + value).join('\r\n')
          params = [...params, '-headers', headers]
        }
        execFile('ffprobe', [...params, host.fileurl], (err, stdout, stderr) => {
          if (err) return tryToGetDuration(err)
          console.log(stderr)
          let info
          try {
            info = JSON.parse(stdout)
          }
          catch(err) {
            return console.error(err)
          }
          host.ffprobe = info
          if (info.format && info.format.duration) {
            host.duration = parseFloat(info.format.duration)
            resolve(host)
          }
          else return tryToGetDuration(info)
        })
      })
    }
    return tryToGetDuration()
  }

  add(url, title, meta) {
    this.allowedHosts.hostAllowed(url).then(host => host.getInfo()).then(async result => {
      //if (!meta.fiku && result.fikuonly) throw new Error('not addable')
      console.log(result)
      console.log(result.matchGroup('id'))
      if (this.bot.playlist.some(item => item.media.id === result.id)) return this.bot.sendMessage('Ist schon in der playlist')
      if (title) result.title = title
      if (result.type === 'cm' && !result.duration) try {
        result = await this.getDuration(result)
      } catch (err) {
        throw err
      }
      //if (result.type === 'cm')
      this.cmManifests[this.fixurl(result.url)] = result
      if (meta.onPlay && typeof meta.onPlay === 'function') this.play.on(result.id, meta.onPlay)
      if (meta.onQueue && typeof meta.onQueue === 'function') this.queue.on(result.id, meta.onQueue)
      if (result.needUserScript) this.queue.once(result.id, () => {
        let userScriptPollId
        const userScriptPoll = () => {
          this.bot.client.once('newPoll', poll => {
            userScriptPollId = poll.timestamp
          })
          this.bot.client.createPoll({
            title: result.title,
            opts: [
              result.url,
              'Geht nur mit Userscript (Letztes update: ' + this.userscriptdate + ') (ks*.user.js bitte löschen)',
              ...this.userScriptPollOpts
            ],
            obscured: false
          })
        }
        userScriptPoll()
        this.del.once(result.id, () => {
          if (this.bot.poll.timestamp === userScriptPollId) this.bot.client.closePoll()
        })
        this.play.on(result.id, data => {
          if (!this.bot.pollactive || this.bot.poll.timestamp != userScriptPollId) userScriptPoll()
          this.bot.client.once('changeMedia', () => {
            if (this.bot.poll.timestamp === userScriptPollId) this.bot.client.closePoll()
          })
        })
      })
      this.bot.addNetzm(result.id, meta.addnext, meta.user, result.type, title || result.title, result.url)
    }).catch(err => {
      console.log(err)
      this.bot.sendByFilter('Kann ' + url + ' nicht addieren. Addierbare Hosts: ' + this.allowedHostsString)
    })
  }
}

module.exports = {
  meta: {
    active: true,
    type: 'giggle'
  },
  giggle: function(ponk){
    return new Promise((resolve, reject) => {
      ponk.API.add = new AddCustom(ponk);
      ponk.logger.log('Registering custom .add');
      resolve();
    })
  },
  handlers: {
    add: function(user, params, meta) {
      const split = params.split(' ')
      let url = split.shift()
      let title = split.join(' ').trim()
      if (url === 'regex') {
        const host = this.API.add.allowedHosts.allowedHosts.find(host => host.name.includes(title))
        if (host) this.sendByFilter(JSON.stringify({
          ...host,
          regex: host.regex.source
        }))
        return
      }
      url = validUrl.isHttpsUri(url)
      if (title === 'download') return this.API.add.allowedHosts.hostAllowed(url).then(host => host.download(url))
      if (url) this.API.add.add(url, title, { user, ...meta })
      else this.sendMessage('Ist keine https-Elfe /pfräh')
    },
    readd: function(user, params, meta) {
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
    },
    gez: function(user, params, meta) {
      this.API.add.gezmanifests.some(({ title, id }) => {
        let stop
        if (this.playlist.some(item => item.media.id === id)) return
        if (params) {
          if (!(new RegExp('^' + params, 'i')).test(title)) return
          else stop = true
        }
        this.mediaSend({ type: 'cm', id })
        if (stop) return true
      })
    }
  }
}
