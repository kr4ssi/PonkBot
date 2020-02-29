'use-scrict';
const fs = require('fs')
const URL = require('url')
const path = require('path')
const { PythonShell } = require('python-shell')
const parseLink = require('./add_parselink.js')

module.exports = class ProviderList extends Array {
  constructor(ponk) {
    super()
    Object.assign(this, {
      bot: ponk,
      kinoxHosts: [],
      userScriptIncludes: [],
      userScriptSources: [],
      supportedProviders: ''
    })
  }
  then(...args) {
    const grpregex = /(^\(\?\w+\))|\(\?P\<(\w+)\>|\(\?\((\w+)\)|\(\?P=(\w+)\)/g
    const priority = ({ id, provider }) => provider.priority || provider.kinoxids[id]
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
            reject('error')
          })
          return { [name]: { regex: new RegExp(regex), groups } }
        }
      }, (err, result) => {
        if (err) throw err.message
        resolve(Object.assign(...result))
      })
    }).then(ytdlRegex => {
      providers.forEach(([name, rules = {}]) => {
        const provider = new Provider(this.bot, name, rules, ytdlRegex)
        this.push(provider)
        if (provider.kinoxids) {
          let kinoxids
          if (Array.isArray(provider.kinoxids)) kinoxids = provider.kinoxids
          else kinoxids = Object.keys(provider.kinoxids)
          kinoxids.forEach(id => this.kinoxHosts.push({ provider, id }))
        }
        if (provider.needUserScript) {
          this.userScriptIncludes.push(provider.regex)
          this.userScriptSources.push({
            regex: provider.regex,
            groups: provider.groups,
            init: provider.userScript
          })
        }
        if (!provider.fikuonly)
        this.supportedProviders += (this.supportedProviders ? ', ' : '') + name
      })
      this.kinoxHosts = this.kinoxHosts.sort((a, b) =>  priority(a) - priority(b))
      return this
    }).then(...args)
  }
  byName(name) {
    return this.find(provider => (new RegExp('^' + name, 'i')).test(provider.name))
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
    }, rules, (typeof rules.regex === 'string') && ytdlRegex[rules.regex])
    this.overview = Object.entries(this).reduce((acc, [key, value]) => {
      if (!['bot', 'regex'].includes(key) && typeof value != 'function')
      acc[key] = value
      return acc
    }, { regex: this.regex.source })
    this.overview = JSON.stringify(this.overview, undefined, 2)
    if (typeof rules.init === 'function') rules.init.call(this)
  }
  getInfo(url, moreargs = []) {
    return new Promise((resolve, reject) => {
      PythonShell.run('youtube_dl', {
        cwd: path.join(__dirname, '..', 'youtube-dl'),
        pythonOptions: ['-m'],
        args: ['--dump-json', '-f', 'best', '--restrict-filenames', ...moreargs,  url]
      }, (err, data) => {
        if (err) {
          return reject(err)
        }
        let info
        try {
          //let data = stdout.trim().split(/\r?\n/)
          info = data.map((rawData) => JSON.parse(rawData))
        }
        catch (err) {
          return console.error(err)
        }
        if (!info.title) info = info[0]
        this.info = info
        if (info.formats && info.formats.length)
        this.formats = info.formats.filter(format => {
          return [240, 360, 480, 540, 720, 1080, 1440].includes(format.height)
        })
        this.title = (new RegExp('^' + this.info.extractor_key, 'i')).test(info.title) ? info.title : (info.extractor_key + ' - ' + info.title)
        this.fileurl = info.url
        if (this.type != 'cm') return resolve(this)
        if (info.manifest_url) this.fileurl = info.manifest_url
        if (info.thumbnail && info.thumbnail.match(/(?:^http:\/\/)/i)) this.thumbnail = info.thumbnail
        this.duration = info.duration
        this.quality = info.height;
        return resolve(this)
      })
    })
  }
  download(url) {
    let pyshell
    return pyshell = new PythonShell('youtube_dl', {
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
          this.fileurl = this.bot.API.keys.filehost + '/files/' + path.basename(this.info._filename)
          fs.chmod(match[1], 0o644, err => {
            if (err) pyshell.emit('error', err)
            fs.stat(this.info._filename, (err, stats) => {
              if (err) pyshell.emit('error', err)
              this.stats = stats
              pyshell.emit('info')
            })
          })
        })
      })
    })
  }
}
const providers = Object.entries({
  'kinox.to': {
    regex: new RegExp(/https?:\/\/(?:www\.)?kino/.source + '(?:[sz]\\.to|x\\.' +
    '(?:tv|me|si|io|sx|am|nu|sg|gratis|mobi|sh|lol|wtf|fun|fyi|cloud|ai|click' +
    '|tube|club|digital|direct|pub|express|party|space|lc|ms|mu|gs|bz|gy|af))' +
    /\/(?:Tipp|Stream\/.+)\.html/.source),
    getInfo(url, gettitle) {
      return this.bot.fetch(url, {
        cloud: true,
        $: true
      }).then(({ match, $, headers }) => {
        const hostname = 'https://' + URL.parse(url).hostname
        const location = hostname + $('.Grahpics a').attr('href')
        if (/\/Tipp\.html$/.test(url))
        this.emit('message', `Addiere: ${location}`)
        const title = ($('title').text().match(/(.*) Stream/) || [])[1]
        const kinoxIds = $('#HosterList').children().map((i, e) => {
          return (e.attribs.id.match(/_(\d+)/) || [])[1]
        }).toArray()
        const kinoxHosts = this.bot.API.add.providerList.kinoxHosts.filter(host => {
          return kinoxIds.includes(host.id)
        })
        const getHost = ({ provider, id } = kinoxHosts.shift()) => {
          if (!provider) return Promise.reject('Kein addierbarer Hoster gefunden')
          const regex = new RegExp(/<b>Mirror<\/b>: (?:(\d+)\/(\d+))/.source +
          /<br ?\/?><b>Vom<\/b>: (\d\d\.\d\d\.\d{4})/.source)
          const hostdiv = $('#Hoster_' + id)
          const data = hostdiv.children('.Data').html()
          console.log(provider, id, hostdiv, data)
          const match = data.match(regex)
          if (!match) return console.log(data)
          let [, initialindex, mirrorcount, date] = match
          console.log(initialindex, mirrorcount, date)
          const filename = (hostdiv.attr('rel').match(/^(.*?)\&/) || [])[1]
          const getMirror = mirrorindex => {
            return this.bot.fetch(hostname + '/aGET/Mirror/' + filename, {
              headers,
              cloud: true,
              json: true,
              qs: {
                Hoster: id,
                Mirror: mirrorindex
              }
            }).then(({ body }) => {
              if (!body.Stream) return console.error(provider, id) // || !body.Replacement
              const mirrorurl = 'https://' + (body.Stream.match(/\/\/([^"]+?)"/) || [])[1]
              if (body.Replacement) {
                const match = body.Replacement.match(regex)
                if (!match) return console.log(body.Replacement)
                mirrorindex = match[1]
                mirrorcount = match[2]
                date = match[3]
                console.log(match[0], mirrorindex, mirrorcount, date)
              }
              this.emit('message', `Addiere Mirror ${mirrorindex}/${mirrorcount}: ${mirrorurl} Vom: ${date}`)
              this.matchUrl(mirrorurl, [provider])
              return this.getInfo().then(addition => {
                addition.title = title
                if (addition.type === 'cm' && !addition.duration)
                return this.bot.API.add.getDuration(addition)
                return addition
              }, () => (mirrorindex != initialindex) ? getMirror(mirrorindex) : getHost())
            })
          }
          return getMirror(initialindex)
        }
        return gettitle ? title : getHost()
      })
    }
  },
  'streamkiste.tv': {
    regex: /https?:\/\/(?:www\.)?streamkiste\.tv\/(?:movie\/[\w-]+(\d{4})-(\d+)|(#captcha$))/,
    groups: ['year', 'id', 'captcha'],
    init() {
      this.bot.db.createTableIfNotExists('captchas', (table) => {
        table.string('token', 512).primary()
      })
      this.bot.server.host.get('/captcha/:token', (req, res) => {
        const token = req.params.token
        console.log(token)
        this.bot.db.knex('captchas').insert({ token }).then(() => {
          return this.bot.db.knex('captchas').count({ count: 'token' })
        }).then(([{ count }]) => {
          console.log(count)
          res.send(token + '<br><br>added count: ' + count)
        })
      })
    },
    getInfo() {
      return this.bot.fetch(this.url, {
        match: /<title>([^<]*) HD Stream &raquo; StreamKiste\.tv<\/title>[\s\S]+pid:"(\d+)/,
        $: true
      }).then(({ match, $ }) => {
        const title = match[1]
        const pid = match[2]
        const rlss = $('#rel > option').map((i, e) => {
          console.log(e.attribs)
          return e.attribs
        }).toArray().filter(({ selected }) => selected != undefined)
        const mirrors = $('[href=\'#video\']').map((i, e) => {
          return e.attribs
        }).toArray().reduce((acc, attribs) => {
          let { 'data-mirror': mirror, 'data-host': host, title } = attribs
          title = (title.match(/'([^']+)/) || [])[1]
          if (!/^nxload/i.test(title)) return acc
          if (!acc[title]) acc[title] = []
          acc[title].push({ host, mirror})
          return acc
        }, {})
        console.log(pid)
        console.log(rlss)
        console.log(mirrors)
        return this.bot.db.knex('captchas').select('token').limit(1).then(result => {
          if (!result.length) {
            throw 'keine captchas'
          }
          const token = result.pop().token
          return this.bot.db.knex('captchas').where({ token }).del().then(() => {
            return this.bot.fetch(this.url, {
              method: 'POST',
              form: {
                req: '3',
                pid,
                ...Object.values(mirrors).pop().pop(),
                rel: rlss.pop().data,
                token
              },
              customerr: [302]
            })
          })
        }).then(({ res, body, statusCode }) => {
          let url
          if (statusCode === 302) url = res.headers.location
          else {
            if (/reCAPTCHA kann nicht erreicht werden/.test(body))
            throw 'reCAPTCHA kann nicht erreicht werden'
            url = body
          }
          console.log(url)
          this.matchUrl(url, this.bot.API.add.providerList)
          return this.getInfo().then(addition => {
            addition.title = title
            if (addition.type === 'cm' && !addition.duration)
            return this.bot.API.add.getDuration(addition)
            return addition
          })
        })
      })
    },
    userScript: function() {
      if (!this.config.captcha || !this.match[3]) return
      const setup = () => {
        const div = document.createElement('div')
        document.body.appendChild(div)
        grecaptcha.render(div, {
          sitekey: '6LcGFzMUAAAAAJaE5lmKtD_Oi_YzC837_Nwt6Btv',
          size: 'invisible',
          callback: token => {
            console.log(token)
            GM.xmlHttpRequest({
              method: 'GET',
              url: `${config.weblink}/captcha/${token}`,
              onload: res => {
                console.log(res.responseText)
                div.remove()
                setup()
              },
              onerror: console.error
            })
          }
        })
        grecaptcha.execute()
      }
      unsafeWindow.setup = setup
      const script = document.createElement('script')
      script.setAttribute('type', 'text/javascript')
      script.setAttribute('src', 'https://www.google.com/recaptcha/api.js?onload=setup&render=explicit')
      document.getElementsByTagName('head').item(0).appendChild(script)
    }
  },
  [['nxload.com',
  'clipwatching.com',
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
    getInfo() {
      if (['nxload.com', 'gounlimited.to'].includes(this.matchGroup('host'))) this.needUserScript = false
      let args = []
      if (['gounlimited.to'].includes(this.matchGroup('host'))) args = ['--no-check-certificate']
      return Provider.prototype.getInfo.call(this, this.url, args)
    },
    kinoxids: {
      '84': 1,
      '87': 3
    },
    userScript: function() {
      const e = /(?:www\.)?vup.to/.test(window.location.hostname) ? (holaplayer && holaplayer.cache_) : document.querySelector('video').firstElementChild || document.querySelector('video')
      if (!e) return false
      this.fileurl = e.src
    }
  },
  'vshare.io': {
    regex: 'VShareIE',
    userScript: function() {
      const e = document.querySelector('video').firstElementChild || document.querySelector('video')
      if (!e) return false
      this.fileurl = e.src
    }
  },
  'vivo.sx': {
    regex: 'VivoIE',
    userScript: function() {
      const e = document.querySelector('video').lastElementChild || document.querySelector('video')
      if (!e) return false
      if (e.paused) return false
      this.fileurl = e.src
    }
  },
  'nxload.com': {
    regex: /https?:\/\/(?:www\.)?nxload\.com\/(?:(?:embed-([^/?#&]+)\.html)|(?:(?:embed\/)?([^/?#&]+)(?:\.html)?))/,
    groups: ['id'],
    getInfo() {
      this.matchUrl(this.url.replace(/embed-/i, '').replace(/\.html$/, ''))
      return this.bot.fetch(this.url, {
        match: /<title>([^<]*) \| Your streaming service/,
        unpack: /src:\\\'([^\\]+)\\'/
      }).then(({ match, unpack }) => {
        this.title = match[1]
        this.fileurl = unpack[1]
        return this
      })
    },
    type: 'cm'
  },
  'onlystream.tv': {
    regex: /https?:\/\/(?:www\.)?onlystream\.tv\/(?:(?:embed-([^/?#&]+)\.html)|(?:([^/?#&]+)(?:\.html)?))/,
    groups: ['host', 'id'],
    getInfo() {
      this.matchUrl(this.url.replace(/embed-/i, '').replace(/\.html$/, ''))
      return this.bot.fetch(this.url, {
        match: /<title>([^<]*) - Onlystream.tv<\/title>[\s\S]+\{src: \"([^"]+)/
      }).then(({ match }) => {
        this.title = match[1]
        this.fileurl = match[2]
        return this
      })
    },
    kinoxids: ['90'],
    priority: 2,
    type: 'cm'
  },
  'vidoza.net': {
    regex: /https?:\/\/(?:www\.)?vidoza\.(?:net|org)\/(?:(?:embed-([^/?#&]+)\.html)|(?:([^/?#&]+)(?:\.html)?))/,
    groups: ['id'],
    getInfo() {
      this.matchUrl(this.url.replace(/embed-/i, '').replace(/\.html$/, ''))
      return this.bot.fetch(this.url, {
        match: /([^"]+\.mp4)[\s\S]+vid_length: '([^']+)[\s\S]+curFileName = "([^"]+)/
      }).then(({ match }) => {
        this.title = match[3]
        this.fileurl = match[1]
        this.duration = parseInt(match[2])
        return this
      })
    },
    kinoxids: ['80'],
    priority: 2,
    userScript: function() {
      const e = pData
      if (!e) return false
      this.fileurl = pData.sourcesCode[0].src
    }
  },
  'streamcrypt.net': {
    getInfo() {
      return this.bot.fetch(this.url).then(({ res }) => {
        this.matchUrl(res.request.uri.href, this.bot.API.add.providerList)
        return this.getInfo()
      })
    },
    priority: 1,
    kinoxids: ['58']
  },
  'thevideos.ga': {
    regex: /https?:\/\/((?:www\.)?thevideos\.ga)\/embed-([^.]+)\.html/,
    groups: ['host', 'id'],
    getInfo() {
      return this.bot.fetch(this.url, {
        match: /<title>([^<]*) EMBED<\/title>/,
      }).then(({ match }) => {
        this.title = match[1]
        this.fileurl = 'https://' + this.matchGroup('host') + '/stream' + this.matchGroup('id') + '.mp4'
        return this
      })
    },
    type: 'cm'
  },
  'tvnow.de': {
    regex: /https?:\/\/((?:www\.)?tvnow.de)\/(.*)/,
    getInfo() {
      return this.bot.fetch(this.url, {
        match: /<title>(.*?) \| TVNOW[\s\S]+?footprint\.net([^\.]+)/,
      }).then(({ match }) => {
        this.title = match[1]
        this.fileurl = 'https://vodnowusoawshls-a.akamaihd.net' + match[2] + '.ism/fairplay.m3u8'
        return this
      })
    },
    type: 'cm'
  },
  'youtube.com': {
    regex: 'YoutubeIE',
    type: 'yt',
    fikuonly: true,
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
        if (this.info.extractor === 'youtube') {
          this.type = 'yt'
          this.fileurl = info.display_id
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
  'f0ck.me': {}
}).concat(Object.entries({
  'twitter.com': {},
  'ARDMediathek': {
    regex: 'ARDMediathekIE'
  },
  'zdf.de': {},
  'wdr.de': {
    regex: 'WDRPageIE'
  },
  'WDRElefant': {
    regex: 'WDRElefantIE'
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
