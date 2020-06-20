'use-scrict';
const fs = require('fs')
const URL = require('url')
const path = require('path')
const { PythonShell } = require('python-shell')
const parseLink = require('./add_parselink.js')
const { File } = require('megajs')
const { Converter } = require('ffmpeg-stream')

module.exports = class ProviderList extends Array {
  constructor(ponk) {
    super()
    Object.assign(this, {
      bot: ponk,
      kinoxHosts: [],
      skisteHosts: [],
      userScriptIncludes: [],
      userScriptSources: [],
      supportedProviders: ''
    })
  }
  then(...args) {
    const grpregex = /(^\(\?\w+\))|\(\?P\<(\w+)\>|\(\?\((\w+)\)|\(\?P=(\w+)\)/g
    return this.then = new Promise((resolve, reject) => {
      PythonShell.run(path.join(__dirname, 'add_youtube-dl_get_regex.py'), {
        cwd: path.join(__dirname, '..', 'youtube-dl'),
        parser: data => {
          let [name, regex, groups] = JSON.parse(data)
          regex = regex.replace(grpregex, (match, p1, p2, p3, p4) => {
            if (p1) return ''
            if (p2) return groups.push(p2) && '('
            const p = p3 || p4
            if (p && (groups.includes(p) || Number(p)))
            return groups.push(p) && (p3 ? '(' : '')
            reject(new Error(match))
          })
          return { [name]: { regex: new RegExp(regex), groups } }
        }
      }, (err, result) => {
        if (err) return reject(err)
        resolve(Object.assign(...result))
      })
    }).then(ytdlRegex => {
      providers.forEach(([name, rules = {}]) => {
        const provider = new Provider(this.bot, name, rules, ytdlRegex)
        this.push(provider)
        const p = (provider, [priority , id]) => ({ provider,
          priority: provider.priority || priority || 1, id
        })
        provider.kinoxids.forEach(kv => this.kinoxHosts.push(p(provider, kv)))
        provider.skisteids.forEach(kv => this.skisteHosts.push(p(provider, kv)))
        if (!provider.fikuonly)
        this.supportedProviders += (this.supportedProviders ? ', ' : '') + name
        if (!provider.needUserScript) return
        this.userScriptIncludes.push(provider.regex)
        this.userScriptSources.push({
          regex: provider.regex,
          groups: provider.groups,
          init: provider.userScript
        })
      })
      this.kinoxHosts.sort((a, b) =>  a.priority - b.priority)
      this.skisteHosts.sort((a, b) =>  a.priority - b.priority)
      return this
    }).then(...args)
  }
  byName(name) {
    return this.find(provider => provider.name.split(',').some(host => {
      return new RegExp('^' + name, 'i').test(host.trim())
    }))
  }
}
class Provider {
  constructor(ponk, name, rules = {}, ytdlRegex) {
    Object.assign(this, {
      bot: ponk,
      name,
      regex: new RegExp(`^https?:\\/\\/([-\\w]+\\.)*${name.replace('.', '\\.')}\\/.+`),
      groups: [],
      type: rules.type || (typeof rules.userScript === 'function' ? 'cm' : 'fi'),
      needUserScript: typeof rules.userScript === 'function'
    }, rules, {
      kinoxids: Object.entries(rules.kinoxids || []),
      skisteids: Object.entries(rules.skisteids || [])
    }, (typeof rules.regex === 'string') && ytdlRegex[rules.regex])
    this.overview = Object.entries(this).reduce((acc, [key, value]) => {
      if (!['bot', 'regex'].includes(key) && typeof value != 'function')
      acc[key] = value
      return acc
    }, { regex: this.regex.source })
    this.overview = JSON.stringify(this.overview, undefined, 2)
    if (typeof rules.init === 'function') rules.init.call(this)
  }
  getInfo(url, moreargs = []) {
    return new Promise((resolve, reject) => PythonShell.run('youtube_dl', {
      cwd: path.join(__dirname, '..', 'youtube-dl'),
      pythonOptions: ['-m'],
      args: [
        '--restrict-filenames',
        '-f', 'best',
        '--dump-json'
      ].concat(moreargs, url)
    }, (err, data) => {
      if (err) return reject(err)
      resolve(data)
    })).then(data => data.map(rawData => JSON.parse(rawData))).then(info => {
      if (Array.isArray(info)) info = info[0]
      return Object.assign(this, {
        info,
        headers: info.http_headers,
        title: `${info.extractor_key} - ${info.title}`,
        fileurl: this.type === 'cm' && info.manifest_url || info.url,
        duration: info.duration || undefined,
        quality: info.height,
        live: info.is_live || false
      }, info.formats && info.formats.length && {
        formats: info.formats.filter(format => {
          return [240, 360, 480, 540, 720, 1080, 1440].includes(format.height)
        })
      }, info.thumbnail && info.thumbnail.match(/(?:^https?:\/\/)/i) && {
        thumbnail: info.thumbnail
      })
    })
  }
  download(url) {
    let pyshell
    return new Promise((resolve, reject) => {
      resolve(pyshell = new PythonShell('youtube_dl', {
        cwd: path.join(__dirname, '..', 'youtube-dl'),
        pythonOptions: ['-m'],
        args: [
          '-o', path.join(this.bot.API.keys.filepath, '%(title)s-%(id)s.%(ext)s'),
          '-f', 'mp4',
          '--restrict-filenames',
          '--write-info-json',
          '--newline',
          '--no-mtime',
          '--no-part',
          url
        ]
      }).on('message', message => {
        this.downloadmsg = message
        const match = message.match(/JSON to: (.*)$/)
        if (match) pyshell.once('message', () => {
          fs.readFile(match[1], (err, info) => {
            if (err) return pyshell.emit('error', err)
            try {
              this.info = JSON.parse(info)
            }
            catch (err) {
              return pyshell.emit('error', err)
            }
            this.type = 'fi'
            this.filename = this.info._filename
            this.title = `${this.info.extractor_key} - ${this.info.title}`
            this.fileurl = this.bot.API.keys.filehost + '/files/' + path.basename(this.filename)
            fs.chmod(match[1], 0o644, err => {
              if (err) pyshell.emit('error', err)
              fs.stat(this.info._filename, (err, stats) => {
                if (err) pyshell.emit('error', err)
                this.size = stats.size
                pyshell.emit('info')
              })
            })
          })
        })
      }))
    })
  }
}
const providers = Object.entries({
  'mega.co.nz': {
    regex: /https:\/\/mega.nz\/#F!([a-zA-Z0-9]{0,8})!([\w-])+/,
    groups: ['id', 'key'],
    type: 'cm',
    download() {
      return new Promise((resolve, reject) => {
        File.fromURL(this.url).loadAttributes((err, file) => {
          if (err) return reject(err)
          console.log(file)
          this.title = file.name
          if (file.directory) file = file.children.shift()
          console.log(file)
          this.size = file.size
          this.filename = path.parse(file.name).name + '.m3u8'
          this.fileurl = this.bot.API.keys.filehost + '/files/' + this.filename
          const pathname = path.join(this.bot.API.keys.filepath, this.filename)
          const converter = new Converter()
          const download = file.download()
          console.log(converter, download)
          download.pipe(converter.createInputStream())
          converter.createOutputToFile(pathname, {c: 'copy', hls_time: 10, hls_list_size: 0, f: 'hls', y: true})
          //movflags: ['+frag_keyframe', '+separate_moof', '+omit_tfhd_offset', '+empty_moov', '+faststart'].join('')
          //download.pipe(fs.createWriteStream(pathname))
          converter.run().catch(err => {
            download.emit(err)
            download.end()
            console.error(err)
          })
          const getDuration = data => {
            const duration = data.match(/Duration: ([^.]+)/)
            if (!duration) return
            this.duration = duration[1].split(':').reverse().reduce((s, c, u) => {
              return s + (c * Math.pow(60, u))
            }, 0)
            console.log(duration, this.duration)
            converter.process.stderr.off('data', getDuration)
          }
          converter.process.stderr.on('data', getDuration)
          resolve(download)
        })
      })
    }
  },
  'streamkiste.tv': {
    regex: /https?:\/\/(?:www\.)?streamkiste\.tv\/movie\/[\w-]+(\d{4})-(\d+)/,
    groups: ['year', 'id', 'captcha'],
    init() {
      this.bot.db.createTableIfNotExists('captchas', table => {
        table.string('token', 512).primary()
      })
      this.bot.server.host.get('/captcha/:token', (req, res) => {
        const token = req.params.token
        console.log(token)
        res.header('Access-Control-Allow-Origin', '*')
        this.bot.db.knex('captchas').insert({ token }).then(() => {
          this.bot.emit('captcha', token)
          const timeout = setTimeout(() => res.send('1'), 5000)
          this.bot.once('needcaptcha', () => {
            clearTimeout(timeout)
            if (!res.headersSent) res.send('')
          })
        })
      })
    },
    getInfo(url, gettitle) {
      return this.bot.fetch(this.url, {
        match: /<title>([^<]*) HD Stream &raquo; StreamKiste\.tv<\/title>[\s\S]+pid:"(\d+)/,
        $: true
      }).then(({ match: [ , title, pid], $, headers }) => {
        const allowed = ['NxLoad', 'Vivo', 'ClipWatching']
        const rel = $('#rel > option[selected]').attr('data')
        const mirrors = $('[href=\'#video\']').map((i, e) => {
          const { 'data-mirror': mirror, 'data-host': host } = e.attribs
          return { mirror, host, name: $(e).find('.hoster').text() }
        }).toArray().filter(({ name }) => allowed.includes(name))
        .sort((a ,b) => allowed.indexOf(a.name) - allowed.indexOf(b.name))
        console.log(pid, rel, mirrors)
        const getMirror = ({ mirror, host } = mirrors.shift() || {}) => {
          if (!mirror) throw 'Kein addierbarer Hoster gefunden'
          console.log(mirror, host)
          const getCaptcha = () => new Promise((resolve, reject) => {
            this.bot.db.knex('captchas').select('token').limit(1).then(result => {
              if (result.length) return resolve(result.pop().token)
              this.emit('message', `Captcha generieren: ${url}#userscript`)
              this.bot.emit('needcaptcha')
              this.bot.once('captcha', resolve)
            })
          }).then(token => {
            return this.bot.db.knex('captchas').where({ token }).del().then(del => {
              if (!del) return getCaptcha()
              return this.bot.fetch(url, {
                method: 'POST',
                form: { req: '3', pid, mirror, host, rel, token },
                customerr: [302],
                $: true,
                headers
              }).then(({ res, body, statusCode, $ }) => {
                if (statusCode === 302) return res.headers.location
                if (/reCAPTCHA kann nicht erreicht werden/.test(body)) {
                  this.emit('message', 'Captcha abgelaufen')
                  return getCaptcha()
                }
                return $('a').attr('href') || body
              })
            })
          })
          return getCaptcha().then(url => {
            this.emit('message', `Addiere Mirror: ${url}`)
            return this.matchUrl(url, this.bot.API.add.providerList).getInfo().then(() => {
              this.title = title
              if (this.type === 'cm' && !this.duration)
              return this.getDuration()
              return this
            }).catch(() => getMirror())
          })
        }
        return this.gettitle ? { title } : getMirror()
      })
    },
    userScript: function() {
      const setup = div => {
        if (div) div.remove()
        div = document.createElement('div')
        document.body.prepend(div)
        grecaptcha.render(div, {
          sitekey: '6LcGFzMUAAAAAJaE5lmKtD_Oi_YzC837_Nwt6Btv',
          size: 'invisible',
          callback: token => {
            console.log(token)
            fetch(`${this.weblink}/captcha/${token}`).then(res => {
              res.text().then(body => console.log(body) || !body && setup(div))
            })
          }
        })
        grecaptcha.execute()
      }
      (unsafeWindow || window).setup = setup
      const script = document.createElement('script')
      script.setAttribute('type', 'text/javascript')
      script.setAttribute('src', 'https://www.google.com/recaptcha/api.js?onload=setup&render=explicit')
      document.getElementsByTagName('head').item(0).appendChild(script)
    }
  },
  'kinox.to': {
    regex: new RegExp(/https?:\/\/(?:www\.)?kino/.source + '(?:[sz]\\.to|x\\.' +
    '(?:tv|me|si|io|sx|am|nu|sg|gratis|mobi|sh|lol|wtf|fun|fyi|cloud|ai|click' +
    '|tube|club|digital|direct|pub|express|party|space|lc|ms|mu|gs|bz|gy|af))' +
    /\/(?:Tipp|Stream\/.+)\.html/.source),
    getInfo(url, gettitle) {
      return this.bot.fetch(url, {
        cloud: true,
        $: true
      }).then(({ $, headers }) => {
        const hostname = 'https://' + URL.parse(url).hostname
        const location = hostname + $('.Grahpics a').attr('href')
        if (/\/Tipp\.html$/.test(url))
        this.emit('message', `Addiere: ${location}`)
        const title = ($('title').text().match(/(.*) Stream/) || [])[1]
        const kinoxIds = $('#HosterList').children().map((i, e) => {
          return (e.attribs.id.match(/_(\d+)/) || [])[1]
        }).toArray()
        const hosts = this.bot.API.add.providerList.kinoxHosts.filter(host => {
          return kinoxIds.includes(host.id)
        }).concat({})
        const getHost = ({ provider, id } = hosts.shift()) => {
          if (!provider) throw 'Kein addierbarer Hoster gefunden'
          const regex = new RegExp(/<b>Mirror<\/b>: (?:(\d+)\/(\d+))/.source +
          /<br ?\/?><b>Vom<\/b>: (\d\d\.\d\d\.\d{4})/.source)
          const hostdiv = $('#Hoster_' + id)
          const match = hostdiv.children('.Data').html().match(regex)
          if (!match) throw data
          var [ , current, count, date] = match
          const initial = current
          const filename = (hostdiv.attr('rel').match(/^(.*?)\&/) || [])[1]
          const getMirror = () => {
            return this.bot.fetch(hostname + '/aGET/Mirror/' + filename, {
              headers,
              cloud: true,
              json: true,
              qs: {
                Hoster: id,
                Mirror: current
              }
            }).then(({ body }) => {
              if (!body.Stream) throw body
              const mirrorurl = 'https://' + (body.Stream.match(/\/\/([^"]+?)"/) || [])[1]
              this.emit('message', `Addiere Mirror ${current}/${count}: ${mirrorurl} Vom: ${date}`)
              if (body.Replacement) {
                const match = body.Replacement.match(regex)
                if (!match) throw body
                ;[ , current, count, date] = match
                console.log(initial, current, count)
              }
              return this.matchUrl(mirrorurl, [provider]).getInfo().then(() => {
                this.title = title
                if (this.type === 'cm' && !this.duration) return this.getDuration()
                return this
              })
            }).catch(err => {
              if (current != initial) return getMirror()
              return getHost()
            })
          }
          return getMirror()
        }
        return this.gettitle ? { title } : getHost()
      })
    }
  },
  'vshare.io': {
    regex: 'VShareIE',
    userScript: function() {
      let e =  document.querySelector('video')
      e = document.querySelector('video').firstElementChild || e
      if (!e) return false
      this.fileurl = e.src
    }
  },
  [['clipwatching.com',
  'gounlimited.to',
  'govid.me',
  'holavid.com',
  'streamty.com',
  'thevideobee.to',
  'uqload.com',
  'vidbom.com',
  'vidlo.us',
  'vidlocker.xyz',
  'vidshare.tv',
  'vup.to',
  'xvideosharing.com'].join(', ')]: {
    regex: 'XFileShareIE',
    getInfo(url) {
      this.matchUrl(url.replace(/embed-/i, '').replace(/\.html$/, ''))
      if (['nxload.com', 'gounlimited.to'].includes(this.matchGroup('host')))
      this.needUserScript = false
      if (['gounlimited.to'].includes(this.matchGroup('host')))
      return Provider.prototype.getInfo.call(this, this.url, [
        '--no-check-certificate'
      ]).then(info => {
        if (info.fileurl.match(/https:\/\/gounlimited\.to\/videojs\d\/small\d\.mp4/))
        throw new Error('Server overload')
      })
      return Provider.prototype.getInfo.call(this, this.url)
    },
    kinoxids: {
      1: '84', // gounlimited
      3: '87'  // clipwatching
    },
    skisteids: { 3: 'ClipWatching' },
    userScript: function() {
      let e =  document.querySelector('video')
      e = document.querySelector('video').firstElementChild || e
      e = holaplayer && holaplayer.cache_ || e
      if (!e) return false
      this.fileurl = e.src
    }
  },
  'nxload.com': {
    regex: /https?:\/\/(?:www\.)?nxload\.com\/(?:embed[-/])?([^/?#&]+)/,
    groups: ['id'],
    getInfo(url) {
      this.matchUrl(url.replace(/embed[-/]/i, '').replace(/\.html$/, ''))
      return this.bot.fetch(this.url, {
        match: /<title>([^<]*) \| Your streaming service/,
        unpack: /src:\\\'([^\\]+)\\'/
      }).then(({ match: [ , title], unpack: [ , fileurl] }) => {
        return Object.assign(this, { title, fileurl })
      })
    },
    type: 'cm',
    skisteids: { 1: 'NxLoad' },
  },
  'onlystream.tv': {
    regex: /https?:\/\/(?:www\.)?onlystream\.tv\/(?:embed-)?([^/?#&]+)/,
    groups: ['id'],
    getInfo(url) {
      this.matchUrl(url.replace(/embed-/i, '').replace(/\.html$/, ''))
      return this.bot.fetch(this.url, {
        match: /<title>([^<]*) - Onlystream.tv<\/title>[\s\S]+\{src: \"([^"]+)/
      }).then(({ match: [ , title], unpack: [ , fileurl] }) => {
        return Object.assign(this, { title, fileurl })
      })
    },
    kinoxids: ['90'],
    priority: 2,
    type: 'cm'
  },
  'upstream.to': {
    regex: /https?:\/\/(?:www\.)?upstream\.to\/(?:embed-)?([^/?#&]+)/,
    groups: ['id'],
    getInfo(url) {
      this.matchUrl(url.replace(/embed-/i, '').replace(/\.html$/, ''))
      return this.bot.fetch(this.url, {
        match: /<title>Watch ([^<]*)[\s\S]+\[{file:"([^"]+)/
      }).then(({ match: [ , title, fileurl] }) => {
        return Object.assign(this, { title, fileurl })
      })
    },
    kinoxids: ['91'],
    priority: 3,
    userScript: function() {
      let match
      document.querySelectorAll('script').forEach(e => {
        match = e.textContent.match(/\[{file:"([^"]+)/) || match
      })
      if (!match) return false
      this.fileurl = match[1]
    }
  },
  'streamtape.com': {
    regex: /https?:\/\/(?:www\.)?streamtape\.com\/[ve]\/([^/?#&]+)/,
    groups: ['id'],
    getInfo(url) {
      return this.bot.fetch(this.url, {
        match: /<meta name="og:title" content="([^"]*)[\s\S]+<div id="videolink" style="display:none;">([^<]+)/
      }).then(({ match: [ , title, fileurl] }) => {
        fileurl = 'https:' + fileurl
        return Object.assign(this, { title, fileurl })
      })
    },
    kinoxids: ['102'],
    priority: 3,
    userScript: function() {
      const e = document.getElementById('videolink')
      if (!e) return false
      this.fileurl = 'https:' + e.innerText
    }
  },
  'voe.sx': {
    regex: /https?:\/\/(?:www\.)?voe\.sx(?:\/e)?\/([^/?#&]+)/,
    groups: ['id'],
    getInfo(url) {
      this.matchUrl(url.replace(/\/e/i, ''))
      return this.bot.fetch(this.url, {
        match: /<title>Watch ([^<]*)[\s\S]+\{src: \"([^"]+)/
      }).then(({ match: [ , title, fileurl] }) => {
        return Object.assign(this, { title, fileurl })
      })
    },
    kinoxids: ['92'],
    skisteids: ['VOE'],
    priority: 3,
    userScript: function() {
      let e =  document.querySelector('video')
      e = document.querySelector('video').firstElementChild || e
      if (!e) return false
      this.fileurl = e.src
    }
  },
  'videobin.co': {
    regex: /https?:\/\/(?:www\.)?videobin\.co\/(?:embed-)?([^/?#&]+)/,
    groups: ['id'],
    getInfo(url) {
      this.matchUrl(url.replace(/embed-/i, ''))
      return this.bot.fetch(this.url, {
        match: /<title>\s+Watch ([^<]*)[\s\S]+sources: \[\"([^"]+)/
      }).then(({ match: [ , title, fileurl] }) => {
        return Object.assign(this, { title, fileurl })
      })
    },
    kinoxids: ['94'],
    priority: 3,
    userScript: function() {
      let e = player && player._options && player._options.sources
      if (!e) return false
      this.fileurl = e[0]
    }
  },
  'vivo.sx': {
    regex: 'VivoIE',
    skisteids: { 2: 'Vivo', },
    userScript: function() {
      let match
      document.querySelectorAll('script').forEach(e => {
        match = e.textContent.match(/\n\t\t\tsource: '([^']+)/) || match
      })
      if (!match) return false
      this.fileurl = (r = (a, b) => ++b ?
      String.fromCharCode((a = a.charCodeAt() + 47, a > 126 ? a - 94 : a))
      : a.replace(/[^ ]/g, r))(decodeURIComponent(match[1]))
    }
  },
  'vidoza.net': {
    regex: /https?:\/\/(?:www\.)?vidoza\.(?:net|org|co)\/(?:embed-)?([^/?#&]+)/,
    groups: ['id'],
    getInfo(url) {
      this.matchUrl(url.replace(/embed-/i, '').replace(/\.html$/, ''))
      return this.bot.fetch(this.url, {
        match: /([^"]+\.mp4)[\s\S]+vid_length: '([^']+)[\s\S]+curFileName = "([^"]+)/
      }).then(({ match: [ , title, duration, fileurl] }) => {
        return Object.assign(this, { title, fileurl, duration: parseFloat(duration) })
      })
    },
    kinoxids: ['80'],
    priority: 4,
    userScript: function() {
      if (!pData) return false
      this.fileurl = pData.sourcesCode[0].src
    }
  },
  'tvnow.de': {
    regex: /https?:\/\/((?:www\.)?tvnow.de)\/(.*)/,
    getInfo() {
      return this.bot.fetch(this.url, {
        match: /<title>(.*?) \| TVNOW[\s\S]+?footprint\.net([^\.]+)/,
      }).then(({ match: [ , title, fileurl] }) => Object.assign(this, {
        title,
        fileurl: `https://vodnowusoawshls-a.akamaihd.net${fileurl}.ism/fairplay.m3u8`
      }))
    },
    type: 'cm'
  },
  'youtube.com': {
    regex: 'YoutubeIE',
    type: 'yt',
    //fikuonly: true,
    getInfo() {
      this.fileurl = this.match[2]
      const match = this.match[0].match(/[?&](?:t|timestamp)=(\d+)/)
      if (match) {
        const timestamp = match[1]
        this.on('play', () => {
          this.bot.client.once('setLeader', () => {
            this.bot.mediaUpdate(parseInt(timestamp, 10), false)
            process.nextTick(() => {
              this.bot.assignLeader('')
            })
          })
          this.bot.assignLeader(this.bot.name)
        })
      }
      return Promise.resolve(this)
    }
  },
  'googledrive': {
    regex: 'GoogleDriveIE',
    type: 'gd',
    fikuonly: true,
    getInfo() {
      this.fileurl = this.matchGroup('id')
      return Promise.resolve(this)
    }
  },
  'dailymotion.com': {
    regex: 'DailymotionIE',
    type: 'dm',
    fikuonly: true,
    getInfo() {
      this.fileurl = this.matchGroup('id')
      return Promise.resolve(this)
    }
  },
  'vimeo.com': {
    regex: 'VimeoIE',
    type: 'vi',
    fikuonly: true,
    getInfo() {
      this.fileurl = this.matchGroup('id')
      return Promise.resolve(this)
    }
  },
  'chilloutzone.net': {
    regex: 'ChilloutzoneIE'
  },
  'gfycat.com': {
    regex: 'GfycatIE'
  },
  'liveleak.com': {
    getInfo() {
      return Provider.prototype.getInfo.call(this, this.url).then(() => {
        this.title = this.info.title
        if (this.info.extractor === 'youtube') {
          this.type = 'yt'
          this.fileurl = this.info.display_id
        }
        else if (this.info.extractor === 'vimeo') {
          this.type = 'vi'
          this.fileurl = this.info.display_id
        }
        return this
      })
    }
  },
  'imgur.com': {},
  'instagram.com': {},
  'ndr.de': {},
  'arte.tv': {},
  'bandcamp.com': {},
  'mixcloud.com': {},
  'archive.org': {
    regex: 'ArchiveOrgIE'
  },
  'ccc.de': {},
  'bitchute.com': {},
  'prosieben.de': {
    regex: 'ProSiebenSat1IE'
  },
  'peertube': {
    regex: 'PeerTubeIE'
  },
  'f0ck.me': {},
  'tiktok.com': {}
}).concat(Object.entries({
  'twitter.com': {},
  'welt.de': {},
  'ARDMediathek': {
    regex: 'ARDMediathekIE',
    getInfo() {
      return Provider.prototype.getInfo.call(this, this.url).then(() => {
        const match = this.info.title.match(/^(.*?)(hr)?(?: im )? Livestream.*$/)
        if (!match) return this
        return Object.assign(this, {
          formats: match[2] ? this.formats.filter(format => {
            return !/sub/.test(format.url)
          }) : this.formats.filter(format => {
            return (format.manifest_url === this.info.manifest_url)
          }),
          title: match[1]
        })
      })
    }
  },
  'zdf.de': {
    regex: 'ZDFIE',
    getInfo() {
      return Provider.prototype.getInfo.call(this, this.url).then(() => {
        this.title = this.title.replace(/(?: im )? Livestream.*$/, '')
        return this
      })
    }
  },
  'wdr.de': {
    regex: 'WDRPageIE'
  },
  'WDRElefant': {
    regex: 'WDRElefantIE'
  },
  'servus.com': {
    regex: 'ServusIE'
  },
  'mdr.de': {},
  'br.de': {},
  'bild.de': {},
  'tvnow.de': {},
  '.m3u8-links': {
    regex: /.*\.m3u8$/,
    getInfo(url) {
      this.title = 'Kein Livestream'
      this.fileurl = url
      return Promise.resolve(this)
    },
  },
  'rest': {
    regex: /.*/,
    fikuonly: true,
    getInfo() {
      const media = parseLink(this.url)
      if (media.type) {
        this.type = media.type
        this.fileurl = media.id
        return Promise.resolve(this)
      }
      return Promise.reject(media.msg)
    }
  }
}).map(([name, rules]) => ([
  name, {
    ...rules,
    type: 'cm'
  }
])))
