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

const URL = require('url')
const path = require('path')
const crypto = require('crypto')
const { execFile } = require('child_process')
const { PythonShell } = require('python-shell')
const UserAgent = require('user-agents')

class addCustom {
  constructor(ponk){
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
        allowedHosts : {},   // Addable Hosts
        //userMedia   : [],    // A list of added media
        cmManifests : {},    // Custom-json-manifests
        userLinks   : {},    // Userlinks for IP-Bound hosters
        userScripts : {},    // Different userscripts
        bot         : ponk   // The bot
      })
      this.allowedHosts = this.setupRegex(Object.assign(...result))
      this.allowedHostsString = this.allowedHosts.map(host => host.name).join(', ')
      this.kinoxHosts = Object.values(this.allowedHosts).filter((host) => {
        return !!host.kinoxid
      }).sort((a, b) => a.priority - b.priority)
      this.setupUserScript();
      this.setupServer();
      this.bot.client.on('queueFail', data => {
        console.log(data)
        this.bot.sendMessage(data.msg.replace(/&#39;/g,  `'`) + ' ' + data.link)
      });
    });
  }

  setupRegex(ydlRegEx) {
    const custom = {
      'rapidvideo.com': {
        regex: /https?:\/\/(?:www\.)?(?:rapidvideo|bitporno)\.com\/[ve]\/([^/?#&])+/,
        getInfo: url => this.bot.fetch(url, {
          match: /<title>([^<]+)[\s\S]+<source src="([^"]+)"/
        }).then(match => ({
          manifest: this.manifest(match[1], match[2]),
          info: {
            webpage_url: url
          },
          host
        })),
        priority: 4
      }
    }
    const needUserScript = {
      'openload.co': Object.assign(ydlRegEx['OpenloadIE'], {
        kinoxid: 'Hoster_67',
        priority: 2
      }),
      'streamango.com, fruithosts.net': Object.assign(ydlRegEx['StreamangoIE'], {
        kinoxid: 'Hoster_72',
        priority: 5
      }),
      'streamcherry.com': Object.assign(ydlRegEx['StreamangoIE'], {
        kinoxid: 'Hoster_82',
        priority: 5
      }),
      'rapidvideo.com': Object.assign(custom['rapidvideo.com'], {
        kinoxid: 'Hoster_71'
      }),
      'bitporno.com': Object.assign(custom['rapidvideo.com'], {
        kinoxid: 'Hoster_75',
      }),
      'verystream.com': Object.assign(ydlRegEx['VerystreamIE'], {
        kinoxid: 'Hoster_85',
        priority: 1
      }),
      'vidoza.net': {
        getInfo: url => this.bot.fetch(url, {
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
        kinoxid: 'Hoster_80',
        priority: 3
      },
    }
    const needManifest = {
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
      },
      'twitter.com': {},
      'ARDMediathek': ydlRegEx['ARDMediathekIE'],
      'zdf.de': {},
      'wdr.de': {},
      'mdr.de': {},
      'br.de': {},
      'bild.de': {},
      'watchbox.de': {},
      ...needUserScript
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
      'kinox.to': {
        regex: /https:\/\/kino(?:[sz]\.to|x\.(?:tv|me|si|io|sx|am|nu|sg|gratis|mobi|sh|lol|wtf|fun|fyi|cloud|ai|click|tube|club|digital|direct|pub|express|party|space))\/(?:Tipp|Stream\/.+)\.html/,
        getInfo: url => {
          const headers = {
            'User-Agent': (new UserAgent()).toString()
          }
          return this.bot.fetch(url, {
            headers,
            cloud: true,
            $: true
          }).then($ => {
            const host = this.kinoxHosts.find(host => $('#' + host.kinoxid).length > 0)
            if (!host) {
              this.bot.sendMessage('Kein addierbarer Mirror gefunden')
              return console.error($('#HosterList').children().toArray())
            }
            console.log($('#' + host.kinoxid).first())
            return this.bot.fetch('https://' + URL.parse(url).hostname + '/aGET/Mirror/' + $('#' + host.kinoxid).attr('rel'), {
              headers,
              cloud: true,
              json: true
            }).then(mirror => {
              if (!mirror.Stream) return console.error(host)
              return host.getInfo.call(this, 'https://' + (mirror.Stream.match(/\/\/([^"]+?)"/) || [])[1], host).then(result => {
                return {
                  manifest: Object.assign(result.manifest, {
                    title: ($('title').html().match(/^(.*) Stream/) || [])[1]
                  }),
                  info: result.info,
                  host: result.host
                }
              })
            })
          })
        }
      }
    }).map(([name, rules]) => Object.assign({
      name,
      regex: new RegExp('^https?:\\/\\/([-\\w]+\\.)*' + name.replace('.', '\\.') + '\\/.+'),
      needManifest: Object.keys(needManifest).includes(name),
      needUserScript: Object.keys(needUserScript).includes(name),
      getInfo: this.ytdl
    }, rules || {}))
  }

  setupUserScript() {
    const allowedHosts = this.allowedHosts.filter(host => host.needUserScript)
    const userscript = require('fs').readFileSync('ks.user.js', {
      encoding: "utf-8"
    }).match(/\B(\/\/ ==UserScript==\r?\n(?:[\S\s]*?)\r?\n\/\/ ==\/UserScript==)\r?\n\r?\nconst config[^\n\r]+(\r?\n[\S\s]*)/);
    if (!userscript) throw new Error('Userscript broken');

    const getHeader = (header = {}) => userscriptmeta.stringify(Object.assign(userscriptmeta.parse(userscript[1]), header, {
      include: allowedHosts.map(host => host.regex).concat(header.include || [])
    }));
    const getScript = (config = {}) => '\nconst config = JSON.parse(\'' + JSON.stringify(Object.assign({
      weblink: this.bot.server.weblink//,
      //allowedHosts: allowedHosts.map(({ name, regex, groups }) => ({
      //  name,
      //  regex: regex.source,
      //  groups
      //}))
    }, config)) + '\')' + userscript[2];

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
    else return this.bot.db.getKeyValue('userscripthash').then(userscripthash => {
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
      res.send('added');
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
          //console.log(headers)
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
          //console.log(info.format)
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
        maxBuffer: 10485760
      }, (err, stdout, stderr) => {
        if (err) {
          this.bot.sendMessage(err.message && err.message.split('\n').filter(line => /^ERROR: /.test(line)).join('\n'))
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
        //console.log(info)
        const title = (new RegExp('^' + info.extractor_key, 'i')).test(info.title) ? info.title : (info.extractor_key + ' - ' + info.title)
        if (!host.needManifest) return resolve({
          title,
          url: info.url.replace(/^http:\/\//i, 'https://')
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
    const host = this.hostAllowed(url)
    if (host) {
      const result = await host.getInfo.call(this, url, host)
      if (!result) return
      else if (result.manifest) {
        const manifest = result.manifest
        if (!manifest.duration && !manifest.live) {
          manifest.duration = await this.getDuration(result)
        }
        if (title) manifest.title = title
        this.cmManifests[this.fixurl(result.info.webpage_url)] = {
          manifest,
          //timestamp,
          user: {}
        }
        if (result.host.needUserScript) {
          manifest.sources[0].url = this.bot.server.weblink + '/redir?url=' + result.info.webpage_url
          this.bot.client.createPoll({
            title: manifest.title,
            opts: [
              'Geht nur mit Userscript (Letztes update: ' + this.userscriptdate + ')',
              ...this.userScripts.map(({ filename, descr }) => this.bot.server.weblink + '/' + filename + ' ' + descr),
              'dann ' + result.info.webpage_url + ' öffnen',
              '(Ok klicken) und falls es schon läuft player neu laden'
            ],
            obscured: false
          })
        }
        console.log(result.info)
        this.bot.addNetzm(this.bot.server.weblink + '/add.json?' + (result.host.needUserScript ? 'userscript&url=' + result.info.webpage_url : 'url=' + url), meta.addnext, meta.user, 'cm', manifest.title)
      }
      else this.bot.addNetzm(result.url, meta.addnext, meta.user, 'fi', title || result.title, url)
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
    return new Promise((resolve, reject)=>{
      ponk.API.add = new addCustom(ponk);
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
        console.log(host)
        if (host) this.sendByFilter(JSON.stringify({
          ...host,
          regex: host.regex.source
        }))
        return
      }
      url = validUrl.isHttpsUri(url)
      if (url) this.API.add.add(url, title, { user, ...meta })
      else this.sendMessage('Ist keine https-Elfe /pfräh')
    }
  }
}
