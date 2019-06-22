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

class addCustom {
  constructor(ponk){
    PythonShell.run('../youtube-dl/youtube-dl_get-regex.py', {
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
      const ydlRegEx = Object.assign(...result)
      const needUserScript = {
        'openload.co': ydlRegEx['OpenloadIE'],
        'streamango.com, fruithosts.net, streamcherry.com': ydlRegEx['StreamangoIE'],
        'rapidvideo.com': {
          regex: /https?:\/\/(?:www\.)?rapidvideo\.com\/v\/([^/?#&])+/
        },
        'verystream.com': ydlRegEx['VerystreamIE']
      }
      const needManifest = {
        'twitter.com': {},
        'daserste.de': {},
        'zdf.de': {},
        'wdr.de': {},
        'mdr.de': {},
        'br.de': {},
        'bild.de': {},
        'watchbox.de': {},
        ...needUserScript
      }
      Object.assign(this, {
        allowedHosts : Object.entries({
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
          ...needManifest
        }).map(([name, rules]) => Object.assign({
          name,
          regex: new RegExp('^https?:\\/\\/([-\\w]+\\.)*' + name.replace('.', '\\.') + '\\/.+'),
          needManifest: Object.keys(needManifest).includes(name),
          needUserScript: Object.keys(needUserScript).includes(name)
        }, rules || {})),
        //userMedia   : [],    // A list of added media
        cmManifests : {},    // Custom-json-manifests
        userLinks   : {},    // Userlinks for IP-Bound hosters
        userScripts : {},    // Different userscripts
        bot         : ponk   // The bot
      })
      this.allowedHostsString = this.allowedHosts.map(host => host.name).join(', ')
      this.setupUserScript();
      this.setupServer();
      this.bot.client.on('queueFail', data => {
        console.log(data)
        this.bot.sendMessage(data.msg.replace(/&#39;/g,  `'`) + ' ' + data.link)
      });
      const Watcher = require('rss-watcher')
      const watcher = new Watcher('https://www.youtube.com/feeds/videos.xml?channel_id=UCNqljVvVXoMv9T7dPTvg0JA')
      watcher.on('new article', article => {
        this.bot.sendMessage(article.title + ' addiert')
        this.add(article.link, undefined, {fiku: true})
      }).on('error', err => {
        console.error(err)
      }).run((err, articles) => {
        if (err) return console.error(err)
        articles.forEach(article => {
          //console.log(article)
        })
      })

    });
  }

  setupUserScript() {
    const userscript = require('fs').readFileSync('ks.user.js', {
      encoding: "utf-8"
    }).match(/\B(\/\/ ==UserScript==\r?\n(?:[\S\s]*?)\r?\n\/\/ ==\/UserScript==)\r?\n\r?\nconst config[^\n\r]+(\r?\n[\S\s]*)/);
    if (!userscript) throw new Error('Userscript broken');

    const getHeader = (header = {}) => userscriptmeta.stringify(Object.assign(userscriptmeta.parse(userscript[1]), header, {
      include: this.allowedHosts.filter(host => host.needUserScript).map(host => host.regex).concat(header.include || [])
    }));
    const getScript = (config = {}) => '\nconst config = JSON.parse(\'' + JSON.stringify(Object.assign({
      weblink: this.bot.server.weblink,
    }, config)) + '\')' + userscript[2];

    this.userScripts.default = getHeader() + getScript();
    this.userScripts.dontask = getHeader() + getScript({
      dontAsk: true
    });
    this.userScripts.new = getHeader({
      include: new RegExp('^https?:\\/\\/cytu\\.be\\/r\\/' + this.bot.client.chan),
      grant: [
        'GM_setValue', 'GM_getValue', 'unsafeWindow'
      ]
    }) + getScript({
      useGetValue: true
    });
    this.userScripts.auto = getHeader() + getScript({
      useSendMessage: true,
      chan: this.bot.client.chan
    })

    const parseDate = userscriptts => date.format(new Date(parseInt(userscriptts)), 'DD.MM.YY');

    if (/localhost/.test(this.bot.server.weblink)) this.userscriptdate = parseDate(this.bot.started);
    else return this.bot.db.getKeyValue('userscripthash').then(userscripthash => {
      const newuserscripthash = crypto.createHash('md5').update(this.userScripts.default).digest('hex');
      if (userscripthash === newuserscripthash) return this.bot.db.getKeyValue('userscriptts').then(userscriptts => {
        this.userscriptdate = parseDate(userscriptts)
      });
      this.userscriptdate = parseDate(this.bot.started);
      this.bot.db.setKeyValue('userscriptts', this.bot.started);
      this.bot.db.setKeyValue('userscripthash', newuserscripthash);
      Object.keys(this.userScripts).forEach((key) => {
        let filename = 'ks.user.js';
        if (key != 'default') filename = 'ks' + '.' + key + '.user.js';
        this.bot.pushToGit(filename, this.userScripts[key])
      })
    });
  }

  setupServer() {
    const md5ip = req => crypto.createHash('md5').update(forwarded(req).pop()).digest('hex');

    const fixurl = url => {
      if (typeof url === 'undefined') return false;
      url = decodeURIComponent(url).replace(/^http:\/\//i, 'https://');
      url = validUrl.isHttpsUri(url);
      if (!url) return false;
      url = url.replace(/https:\/\/(openload.co|oload\.[a-z0-9-]{2,})\/(f|embed)\//, 'https://openload.co/f/');
      return url.replace(/https:\/\/(streamango\.com|fruithosts\.net)\/(f|embed)\//, 'https://streamango.com/f/');
    }

    const userlink = (req, res) => {
      const url = fixurl(req.query.url);
      if (!url) return res.send('invalid url');
      if (!req.query.userlink) return res.send('invalid userlink');
      if (!this.userLinks[url]) this.userLinks[url] = {};
      this.userLinks[url][md5ip(req)] = req.query.userlink;
      res.send('added');
    }

    this.bot.server.host.get('/userlink', userlink);

    this.bot.server.host.get('/add.json', (req, res) => {
      if (req.query.userlink) return userlink(req, res);
      const url = fixurl(req.query.url)
      if (!url) return res.send('invalid url');
      const cmManifest = this.cmManifests[url];
      if (!cmManifest) return res.sendStatus(404);
      res.json(cmManifest.manifest);
    });

    this.bot.server.host.get('/redir', (req, res) => {
      const empty = 'https://ia801501.us.archive.org/0/items/youtube-yUUjeindT5U/VHS_simple_static_noise_-_Motion_background_loop_1-yUUjeindT5U.mp4';
      const url = fixurl(req.query.url);
      if (!url) return res.redirect(empty);
      const userLinks = this.userLinks[url];
      if (userLinks && userLinks[md5ip(req)]) res.redirect(userLinks[md5ip(req)]);
      else res.redirect(empty);
    });

    Object.keys(this.userScripts).forEach((key) => {
      let filename = 'ks.user.js';
      if (key != 'default') filename = 'ks' + '.' + key + '.user.js';
      this.bot.server.host.get('/' + filename, (req, res) => {
        res.end(this.userScripts[key]);
      })
    })
  }

  add (url, title, { user, willkür, fiku }) {
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
        manifest.sources[0].url = this.bot.server.weblink + '/redir?url=' + url
        this.bot.client.createPoll({
          title: manifest.title,
          opts: [
            'Geht nur mit Userscript',
            this.bot.server.weblink + '/ks.user.js (update vom ' + this.userscriptdate + ')',
            this.bot.server.weblink + '/ks.dontask.user.js (ODER ohne Abfrage)',
            this.bot.server.weblink + '/ks.new.user.js (ODER neue Methode, ohne Umweg über den Server, aber mit zusätzlichen Berechtigungen, nach Installation muss der Synch neu ladiert werden)',
            'dann ' + url + ' öffnen',
            '(Ok klicken) und falls es schon läuft player neu laden'
          ],
          obscured: false
        })
      }
      this.bot.addNetzm(this.bot.server.weblink + '/add.json?' + (host.needUserScript ? 'userscript&' : '') + 'url=' + url, willkür, user, 'cm', manifest.title)
    }
    const getDuration = (manifest, info = {}) => {
      return new Promise((resolve, reject) => {
        if (manifest.live || manifest.duration) return resolve(manifest)
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
      this.bot.fetch(url.replace(/embed-/i, ''), {
        json: false
      }).then(body => {
        const regMatch = body.match(/master\.m3u8","([^"]+)"(?:,"([^"]+)")?/i)
        if (!regMatch) {
          this.bot.sendMessage('Fehler')
          return console.error(body)
        }
        const titleMatch = body.match(/<title>Watch ([^<]+)/i)
        if (!title && titleMatch) title = titleMatch[1]
        if (!regMatch[2]) return this.bot.addNetzm(regMatch[1].replace(/^http:\/\//i, 'https://'), willkür, user, 'fi', title)
        manifest.title = title
        manifest.sources[0].url = regMatch[2].replace(/^http:\/\//i, 'https://')
        manifest.sources[0].contentType = 'video/mp4'
        manifest.sources[1] = {}
        manifest.sources[1].url = regMatch[1].replace(/^http:\/\//i, 'https://')
        manifest.sources[1].contentType = 'video/mp4'
        manifest.sources[1].quality = 1080
        getDuration(manifest).then(sendJson)
      })
    }
    if (url.match(/https?:\/\/(?:www\.)?nxload\.com\/(?:embed-)?(\w+)/i)) return nxLoad()
    if (/.*\.m3u8$/.test(url)) return getDuration(manifest).then(sendJson)
    host = this.hostAllowed(url)
    if (host) return execFile('../youtube-dl/youtube-dl', ['--dump-json', '-f', 'best', '--restrict-filenames', url], {
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
      console.log(info)
      title = title || ((new RegExp('^' + info.extractor_key, 'i')).test(info.title) ? info.title : (info.extractor_key + ' - ' + info.title))
      if (!host.needManifest) return this.bot.addNetzm(info.url.replace(/^http:\/\//i, 'https://'), willkür, user, 'fi', title, url)
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
      if (host.name === 'rapidvideo.com') {
        manifest.title = manifest.title.replace(/^Generic/, 'Rapidvideo')
        url = url.replace(/rapidvideo\.com\/e\//, 'rapidvideo.com/v/')
      }
      if ([240, 360, 480, 540, 720, 1080, 1440].includes(info.width)) manifest.sources[0].quality = info.width;
      if (info.thumbnail && info.thumbnail.match(/^https?:\/\//i)) manifest.thumbnail = info.thumbnail.replace(/^http:\/\//i, 'https://')
      manifest.sources[0].url = manifest.sources[0].url.replace(/^http:\/\//i, 'https://')
      manifest.duration = info.duration
      getDuration(manifest, info).then(sendJson)
    })
    if (!fiku) return this.bot.sendByFilter('Kann ' + url + ' nicht addieren. Addierbare Hosts: ' + this.allowedHostsString)
    const media = parseLink(url)
    if (media.type) return this.bot.mediaSend({ type: media.type, id: media.id, pos: 'next', title })
    if (media.msg) this.bot.sendMessage(media.msg)
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
        if (host) this.sendMessage(JSON.stringify({
          ...host,
          regex: host.regex.source
        }))
        return
      }
      url = validUrl.isHttpsUri(url)
      if (url) this.API.add.add(url, title, { user, willkür: meta.addnext })
      else this.sendMessage('Ist keine https-Elfe /pfräh')
    }
  }
}
