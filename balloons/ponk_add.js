/*!
**|   PonkBot add
**@
*/

'use strict';

const parseLink = require('./parselink.js')

const validUrl = require('valid-url')
const date = require('date-and-time')
const forwarded = require('forwarded');
const userscriptmeta = require('userscript-meta')

const EventEmitter = require('events');
const URL = require('url')
const path = require('path')
const crypto = require('crypto')
const { execFile } = require('child_process')
const { PythonShell } = require('python-shell')
const UserAgent = require('user-agents')
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();
const toSource = source => require('js-beautify').js(require('tosource')(source), {
  indent_size: 2,
  keep_array_indentation: true
})

class AddCustom {
  constructor(ponk) {
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
      Object.assign(this, {
        allowedHosts : this.setupRegex(Object.assign(...result)),
        //userMedia   : [],    // A list of added media
        cmManifests : {},    // Custom-json-manifests
        userLinks   : {},    // Userlinks for IP-Bound hosters
        userScripts : {},    // Different userscripts
        bot         : ponk   // The bot
      })
      this.allowedHostsString = this.allowedHosts.map(host => host.name).join(', ')
      this.setupUserScript();
      this.setupServer();
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
    });
  }

  setupRegex(ydlRegEx) {
    const needManifest = {
      'twitter.com': {},
      'ARDMediathek': ydlRegEx['ARDMediathekIE'],
      'zdf.de': {},
      'wdr.de': ydlRegEx['WDRPageIE'],
      'WDRElefant': ydlRegEx['WDRElefantIE'],
      'mdr.de': {},
      'br.de': {},
      'bild.de': {},
      'tvnow.de': {},
      '.m3u8-links': {
        regex: /.*\.m3u8$/,
        getInfo: url => ({
          manifest: this.manifest('Kein Livestream', url),
          host,
        })
      },
      'nxload.com': {
        getInfo: url => this.bot.fetch(url.replace(/embed-/i, '').replace(/\.html$/, ''), {
          match: /title: '([^']*)[\s\S]+https\|(.+)\|nxload\|com\|hls\|(.+)\|urlset/
        }).then(match => ({
          manifest: this.manifest(match[1], 'https://' + match[2] + '.nxload.com/hls/' + match[3].replace(/\|/g, '-') + ',,.urlset/master.m3u8'),
          host,
        }))
      }
    }
    return Object.entries({
      'liveleak.com': {},
      'imgur.com': {},
      'instagram.com': {},
      'ndr.de': {},
      'arte.tv': {},
      'bandcamp.com': {},
      'mixcloud.com': {},
      'archive.org': {},
      'ccc.de': {},
      'bitchute.com': {},
      'prosieben.de': ydlRegEx['ProSiebenSat1IE'],
      'peertube': ydlRegEx['PeerTubeIE'],
      ...needManifest,
      'verystream.com, woof.tube': {
        ...ydlRegEx['VerystreamIE'],
        kinoxids: ['85'],
        priority: 1,
        userScript: () => {
          const e = document.querySelector("[id^=videolink]")
          if (!e) return
          link += `/gettoken/${e.textContent}?mime=true`
          return true
        }
      },
      'openload.co': {
        ...ydlRegEx['OpenloadIE'],
        kinoxids: ['67'],
        priority: 2,
        userScript: () => {
          let e = document.querySelector("[id^=lqEH1]")
          if (!e) e = document.querySelector("[id^=streamur]")
          if (!e) e = document.querySelector("#mediaspace_wrapper > div:last-child > p:last-child")
          if (!e) e = document.querySelector("#main p:last-child")
          if (!e) return
          if (e.textContent.match(/(HERE IS THE LINK)|(enough for anybody)/)) return
          link += `/stream/${e.textContent}?mime=true`
          return true
        }
      },
      'vidoza.net': {
        regex: /https?:\/\/(?:www\.)?vidoza\.net\/(?:embed-([^/?#&]+)\.html|([^/?#&]+))/,
        groups: ['id'],
        getInfo: (url, host) => this.bot.fetch(url, {
          match: /([^"]+\.mp4)[\s\S]+vid_length: '([^']+)[\s\S]+curFileName = "([^"]+)/
        }).then(match => {
          const manifest = this.manifest(match[3], match[1])
          manifest.duration = parseInt(match[2])
          manifest.sources[0].contentType = 'video/mp4';
          return {
            manifest,
            info: {
              webpage_url: url
            },
            host
          }
        }),
        kinoxids: ['80'],
        priority: 3,
        userScript: () => {
          const e = window.pData
          if (!e) return
          link = window.pData.sourcesCode[0].src
          return true
        }
      },
      'rapidvideo.com, bitporno.com': {
        regex: /https?:\/\/(?:www\.)?(?:rapidvideo|bitporno)\.com\/[ve]\/([^/?#&])+/,
        groups: ['id'],
        getInfo: (url, host) => this.bot.fetch(url, {
          match: /<title>([^<]+)[\s\S]+<source src="([^"]+)"/
        }).then(match => ({
          manifest: this.manifest(match[1], match[2]),
          info: {
            webpage_url: url
          },
          host
        })),
        kinoxids: ['71', '75'],
        priority: 4,
        userScript: () => {
          const e = document.querySelector('video').lastElementChild || document.querySelector('video')
          if (!e) return
          link = e.src
          return true
        }
      },
      'streamango.com, fruithosts.net, streamcherry.com': {
        ...ydlRegEx['StreamangoIE'],
        kinoxids: ['72', '82'],
        priority: 5,
        userScript: () => {
          const e = document.querySelector("[id^=mgvideo_html5_api]")
          if (!e) return
          link = e.src
          return true
        }
      },
      'kinox.to': {
        regex: /https?:\/\/(?:www\.)?kino(?:[sz]\.to|x\.(?:tv|me|si|io|sx|am|nu|sg|gratis|mobi|sh|lol|wtf|fun|fyi|cloud|ai|click|tube|club|digital|direct|pub|express|party|space))\/(?:Tipp|Stream\/.+)\.html/,
        getInfo: url => {
          const headers = {
            'User-Agent': (new UserAgent()).toString()
          }
          return this.bot.fetch(url, {
            headers,
            cloud: true,
            $: true
          }).then($ => {
            const hostname = 'https://' + URL.parse(url).hostname
            if (/\/Tipp\.html$/.test(url)) this.bot.sendMessage('Addiere: ' + hostname + $('.Grahpics a').attr('href'))
            const hosts = $('#HosterList').children().map((i, e) => (e.attribs.id.match(/_(\d+)/) || [])[1]).toArray()
            .map(id => ({ id, host: this.allowedHosts.find(host => host.kinoxids && host.kinoxids.includes(id))}))
            .filter(host => host.host).sort((a, b) => a.host.priority - b.host.priority)
            console.log(hosts)
            const title = entities.decode(($('title').html().match(/^(.*) Stream/) || [])[1])
            const getHost = () => {
              let host = hosts.shift()
              if (!host) {
                this.bot.sendMessage('Kein addierbarer Hoster gefunden')
                return
              }
              const hostdiv = $('#Hoster_' + host.id)
              const data = hostdiv.children('.Data').text()
              const match = data.match(/Mirror: (?:(\d+)\/(\d+))Vom: (\d\d\.\d\d\.\d{4})$/)
              if (!match) return console.log(data)
              let [, mirrorindex, mirrorcount, date] = match
              console.log(mirrorindex, mirrorcount, date)
              const filename = (hostdiv.attr('rel').match(/^(.*?)\&/) || [])[1]
              console.log(filename)
              const getMirror = mirrorindex => this.bot.fetch(hostname + '/aGET/Mirror/' + filename, {
                headers,
                cloud: true,
                json: true,
                qs: {
                  Hoster: host.id,
                  Mirror: mirrorindex
                }
                //getprop: 'Stream',
                //match: /\/\/([^"]+?)"/
              }).then(mirror => {
                if (!mirror.Stream) return console.error(host.host)
                const mirrorurl = 'https://' + (mirror.Stream.match(/\/\/([^"]+?)"/) || [])[1]
                let match
                if (mirror.Replacement) {
                  match = mirror.Replacement.match(/<b>Mirror<\/b>: (?:(\d+)\/(\d+))<br \/><b>Vom<\/b>: (\d\d\.\d\d\.\d{4})/)
                  if (!match) return console.log(mirror.Replacement)
                  mirrorindex = match[1]
                  date = match[3]
                  console.log(mirrorindex, mirrorcount, date)
                }
                this.bot.sendMessage('Addiere Mirror ' + mirrorindex + '/' + mirrorcount + ': ' + mirrorurl + ' Vom: ' + date)
                mirrorcount--
                return host.host.getInfo.call(this, mirrorurl.match(host.host.regex)[0], host.host).then(result => {
                  return {
                    ...result,
                    manifest: {
                      ...result.manifest,
                      title
                    }
                  }
                }, () => (mirrorcount > 0) ? getMirror(mirrorcount) : getHost())
              })
              return getMirror(mirrorcount)
            }
            return getHost()
          })
        }
      }
    }).map(([name, rules]) => Object.assign({
      name,
      regex: new RegExp('^https?:\\/\\/([-\\w]+\\.)*' + name.replace('.', '\\.') + '\\/.+'),
      needManifest: Object.keys(needManifest).includes(name) || typeof rules.userScript === 'function',
      needUserScript: typeof rules.userScript === 'function',
      getInfo: this.ytdl
    }, rules || {}))
  }

  setupUserScript() {
    const userscript = require('fs').readFileSync('ks.user.js', {
      encoding: "utf-8"
    }).match(/\B(\/\/ ==UserScript==\r?\n(?:[\S\s]*?)\r?\n\/\/ ==\/UserScript==)\r?\n\r?\nconst allowedHosts[^\n\r]+\r?\n\r?\nconst config[^\n\r]+(\r?\n[\S\s]*)/);
    if (!userscript) throw new Error('Userscript broken');
    const userScriptHeader = userscriptmeta.parse(userscript[1])
    const allowedHosts = this.allowedHosts.filter(host => host.needUserScript)
    const includes = allowedHosts.map(host => host.regex)
    const allowedHostsSource = toSource(allowedHosts.map(({ regex, groups, userScript }) => ({
      regex,
      groups,
      getInfo: userScript
    })))

    const getHeader = (header = {}) => userscriptmeta.stringify(Object.assign(userScriptHeader, header, {
      include: includes.concat(header.include || [])
    }));
    const getScript = (config = {}) => '\nconst allowedHosts = ' + allowedHostsSource + '\n\nconst config = ' + toSource(Object.assign({
      weblink: this.bot.server.weblink,
    }, config)) + userscript[2];

    this.userScripts = [{
      filename: 'ks.user.js',
      userscript: getHeader() + getScript(),
      descr: ''
    }, {
      filename: 'ks.dontask.user.js',
      userscript: getHeader() + getScript({
        dontAsk: true
      }),
      descr: '(ODER ohne Abfrage)'
    }, {
      filename: 'ks.new.user.js',
      userscript: getHeader({
        include: new RegExp('^https?:\\/\\/cytu\\.be\\/r\\/' + this.bot.client.chan),
        grant: [
          'GM_setValue', 'GM_getValue', 'unsafeWindow'
        ]
      }) + getScript({
        useGetValue: true
      }),
      descr: '(ODER neue Methode, ohne Umweg über den Server, aber mit zusätzlichen Berechtigungen, nach Installation muss der Synch neu ladiert werden)'
    }, {
      filename: 'ks.auto.user.js',
      userscript: getHeader() + getScript({
        useSendMessage: true,
        chan: this.bot.client.chan
      }),
      descr: ''
    }];

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
      ...this.userScripts.map(({ filename, descr }) => this.bot.server.weblink + '/' + filename + ' ' + descr)
    ]
  }

  fixurl(url) {
    if (typeof url === 'undefined') return false;
    url = decodeURIComponent(url).replace(/^http:\/\//i, 'https://');
    url = validUrl.isHttpsUri(url);
    if (!url) return false;
    url = url.replace(/https:\/\/(openload.co|oload\.[a-z0-9-]{2,})\/(f|embed)\//, 'https://openload.co/f/');
    return url.replace(/https:\/\/(streamango\.com|fruithosts\.net)\/(f|embed)\//, 'https://streamango.com/f/');
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

    this.userScripts.forEach(({ filename, userscript }) => {
      this.bot.server.host.get('/' + filename, (req, res) => {
        res.end(userscript);
      });
    });
  }

  manifest(title = '', url = '') {
    return {
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
  }

  getDuration({ manifest, info = {} }) {
    return new Promise((resolve, reject) => {
      let tries = 0
      const tryToGetDuration = err => {
        if (err) {
          console.error(err)
          if (tries > 1) {
            return this.bot.sendMessage('Can\'t get duration')
          }
        }
        tries++
        let params = ['-v', 'error', '-show_format', '-show_streams', '-icy', '0', '-print_format', 'json']
        if (info.http_headers) {
          const headers = Object.entries(info.http_headers).map(([key, value]) => key + ': ' + value).join('\r\n')
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
          if (info.format && info.format.duration) resolve(parseFloat(info.format.duration))
          else tryToGetDuration(info)
        })
      }
      tryToGetDuration()
    })
  }

  ytdl(url, host) {
    return new Promise((resolve, reject) => {
      execFile('./youtube-dl/youtube-dl', ['--dump-json', '-f', 'best', '--restrict-filenames', url], {
        maxBuffer: 104857600
      }, (err, stdout, stderr) => {
        if (err) {
          this.bot.sendMessage(url + ' ' + (err.message && err.message.split('\n').filter(line => /^ERROR: /.test(line)).join('\n')))
          return reject(console.error(err))
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
        const title = (new RegExp('^' + info.extractor_key, 'i')).test(info.title) ? info.title : (info.extractor_key + ' - ' + info.title)
        if (!host.needManifest) return resolve({
          title,
          url: info.url.replace(/^http:\/\//i, 'https://'),
          host,
          info
        })
        const manifest = this.manifest(title, url)
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
        if ([240, 360, 480, 540, 720, 1080, 1440].includes(info.width)) manifest.sources[0].quality = info.width;
        if (info.thumbnail && info.thumbnail.match(/^https?:\/\//i)) manifest.thumbnail = info.thumbnail.replace(/^http:\/\//i, 'https://')
        manifest.sources[0].url = manifest.sources[0].url.replace(/^http:\/\//i, 'https://')
        manifest.duration = info.duration
        return resolve({
          manifest,
          info,
          host
        })
      })
    })
  }

  async add(url, title, meta) {
    url = url.split('#').shift()
    const host = this.hostAllowed(url)
    if (host) {
      url = url.match(host.regex)[0]
      const result = await host.getInfo.call(this, url, host)
      if (!result) return
      let id = result.url
      let type = 'fi'
      if (result.info.extractor === 'youtube') {
        type = 'yt'
        id = result.info.display_id
      }
      const manifest = result.manifest
      if (manifest) {
        id = this.bot.server.weblink + '/add.json?' + (result.host.needUserScript ? 'userscript&' : '') + 'url=' + result.info.webpage_url
        if (!manifest.duration && !manifest.live) {
          manifest.duration = await this.getDuration(result)
        }
        if (title) manifest.title = title
        this.cmManifests[this.fixurl(result.info.webpage_url)] = {
          manifest,
          //timestamp,
          user: {}
        }
        type = 'cm'
        title = manifest.title
      }
      if (this.bot.playlist.some(item => item.media.id === id)) return this.bot.sendMessage('Ist schon in der playlist')
      if (result.host.needUserScript) {
        manifest.sources[0].url = this.bot.server.weblink + '/redir?url=' + result.info.webpage_url
        let userScriptPollId
        const userScriptPoll = () => {
          this.bot.client.createPoll({
            title: manifest.title,
            opts: [
              result.info.webpage_url,
              'Geht nur mit Userscript (Letztes update: ' + this.userscriptdate + ')',
              ...this.userScriptPollOpts,
              'dann ' + result.info.webpage_url + ' öffnen',
              '(Ok klicken) und falls es schon läuft player neu laden'
            ],
            obscured: false
          })
          this.bot.client.once('newPoll', poll => {
            userScriptPollId = poll.timestamp
          })
        }
        userScriptPoll()
        this.del.once(id, () => {
          if (this.bot.poll.timestamp === userScriptPollId) this.bot.client.closePoll()
        })
        this.play.once(id, data => {
          if (!this.bot.pollactive || this.bot.poll.timestamp != userScriptPollId) userScriptPoll()
          this.bot.client.once('changeMedia', () => {
            if (this.bot.poll.timestamp === userScriptPollId) this.bot.client.closePoll()
          })
        })
      }
      this.bot.addNetzm(id, meta.addnext, meta.user, type, title || result.title, url)
      if (meta.onPlay && typeof meta.onPlay === 'function') this.play.once(id, meta.onPlay)
      if (meta.onQueue && typeof meta.onQueue === 'function') this.queue.once(id, meta.onQueue)
    }
    else {
      if (!meta.fiku) return this.bot.sendByFilter('Kann ' + url + ' nicht addieren. Addierbare Hosts: ' + this.allowedHostsString)
      const media = parseLink(url)
      if (media.type) return this.bot.mediaSend({ type: media.type, id: media.id, pos: meta.addnext ? 'next' : 'end', title })
      if (media.msg) this.bot.sendMessage(media.msg)
    }
  }

  hostAllowed(url) {
    return this.allowedHosts.find(host => host.regex.test(url))
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
        const host = this.API.add.allowedHosts.find(host => host.name.includes(title))
        if (host) this.sendByFilter(JSON.stringify({
          ...host,
          regex: host.regex.source
        }))
        return
      }
      url = validUrl.isHttpsUri(url)
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
    }
  }
}
