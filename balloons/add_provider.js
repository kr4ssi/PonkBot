'use-scrict';

const { PythonShell } = require('python-shell')
const path = require('path')
const URL = require('url')
const fs = require('fs')
const Entities = require('html-entities').AllHtmlEntities
const entities = new Entities();

const parseLink = require('./add_parselink.js')

module.exports = class ProviderList extends Array {
  constructor(ponk) {
    super()
    const grpregex = /(^\(\?\w+\))|\(\?P\<(\w+)\>|\(\?\((\w+)\)|\(\?P=(\w+)\)/g
    Object.assign(this, {
      ytdlRegex: new Promise((resolve, reject) => {
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
        return Object.assign(this, providers.reduce((acc, [name, rules = {}]) => {
          const provider = new Provider(ponk, name, rules, ytdlRegex)
          this.push(provider)
          if (provider.kinoxids) {
            let kinoxids
            if (Array.isArray(provider.kinoxids)) kinoxids = provider.kinoxids
            else kinoxids = Object.keys(provider.kinoxids)
            kinoxids.forEach(id => acc.kinoxHosts.push({ id, provider }))
          }
          if (provider.needUserScript) {
            acc.userScriptIncludes.push(provider.regex)
            acc.userScriptSources.push({
              regex: provider.regex,
              groups: provider.groups,
              getInfo: provider.userScript
            })
          }
          if (!provider.fikuonly) {
            acc.supportedProviders += (acc.supportedProviders ? ', ' : '') + name
          }
          return acc
        }, {
          kinoxHosts: [],
          userScriptIncludes: [],
          userScriptSources: [],
          supportedProviders: ''
        }))
      }),
      then: (...args) => this.then = this.ytdlRegex.then(...args)
    })
  }
}
class Provider {
  constructor(ponk, name, rules = {}, ytdlRegex) {
    Object.assign(this, {
      bot: ponk,
      name,
      regex: new RegExp('^https?:\\/\\/([-\\w]+\\.)*' + name.replace('.', '\\.') + '\\/.+'),
      groups: [],
      type: rules.type || (typeof rules.userScript === 'function' ? 'cm' : 'fi'),
      needUserScript: typeof rules.userScript === 'function'
    }, rules, (typeof rules.regex === 'string') && ytdlRegex[rules.regex])
  }
  getInfo(url, moreargs = []) {
    return new Promise((resolve, reject) => {
      PythonShell.run('youtube_dl', {
        cwd: path.join(__dirname, '..', 'youtube-dl'),
        pythonOptions: ['-m'],
        args: ['--dump-json', '-f', 'best', '--restrict-filenames', ...moreargs,  url]
      }, (err, data) => {
        if (err) {
          this.bot.sendMessage(url + ' ' + (err.message && err.message.split('\n').filter(line => /^ERROR: /.test(line)).join('\n')))
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
        if (!info.title) info = info[0];
        this.info = info
        if (info.formats && info.formats.length) this.formats = info.formats.filter(format => [240, 360, 480, 540, 720, 1080, 1440].includes(format.height))
        this.title = (new RegExp('^' + this.info.extractor_key, 'i')).test(info.title) ? info.title : (info.extractor_key + ' - ' + info.title)
        this.fileurl = info.url.replace(/(?:^http:\/\/)/i, 'https://')
        if (this.type != 'cm') return resolve(this)
        if (info.manifest_url) this.fileurl = info.manifest_url.replace(/(?:^http:\/\/)/i, 'https://')
        if (info.thumbnail && info.thumbnail.match(/(?:^http:\/\/)/i)) this.thumbnail = info.thumbnail.replace(/(?:^http:\/\/)/i, 'https://')
        this.duration = info.duration
        this.quality = info.height;
        return resolve(this)
      })
    })
  }
  download(url) {
    let infofilename
    return new PythonShell('youtube_dl', {
      cwd: path.join(__dirname, '..', 'youtube-dl'),
      pythonOptions: ['-m'],
      args: [
        '-o', path.join(this.bot.API.keys.filepath, '%(title)s-%(id)s.%(ext)s'),
        '-f', 'mp4',
        '--restrict-filenames',
        '--write-info-json',
        '--newline',
        '--no-mtime',
        url
      ]
    }).on('message', message => {
      if (!infofilename && message.startsWith('[info]')) {
        const match = message.match(/JSON to: (.*)$/)
        if (match) infofilename = match[1]
      }
    }).on('close', () => {
      const info = JSON.parse(fs.readFileSync(infofilename))
      const filename = path.basename(info._filename)
      fs.chmodSync(infofilename, 0o644)
      this.bot.sendMessage(filename + ' wird addiert')
      this.bot.addNetzm(this.bot.API.keys.filehost + '/files/' + filename, false, this.bot.name, 'fi', info.title)
    })
  }
}
const providers = Object.entries({
  'kinox.to': {
    regex: /https?:\/\/(?:www\.)?kino(?:[sz]\.to|x\.(?:tv|me|si|io|sx|am|nu|sg|gratis|mobi|sh|lol|wtf|fun|fyi|cloud|ai|click|tube|club|digital|direct|pub|express|party|space))\/(?:Tipp|Stream\/.+)\.html/,
    getInfo(url, gettitle) {
      return this.bot.fetch(url, {
        cloud: true,
        match: /<title>(.*) Stream/,
        $: true
      }).then(({ match, $, headers }) => {
        const hostname = 'https://' + URL.parse(url).hostname
        const location = hostname + $('.Grahpics a').attr('href')
        if (/\/Tipp\.html$/.test(url)) this.bot.sendMessage('Addiere: ' + location)
        const title = entities.decode(match[1])
        if (gettitle) return { title, location }
        const kinoxIds = $('#HosterList').children().map((i, e) => (e.attribs.id.match(/_(\d+)/) || [])[1]).toArray()
        const kinoxHosts = this.bot.API.add.providerList.kinoxHosts.filter(host => {
          return kinoxIds.includes(host.id)
        })
        console.log(kinoxHosts)
        const getHost = () => {
          let kinoxHost = kinoxHosts.shift()
          if (!kinoxHost) {
            this.bot.sendMessage('Kein addierbarer Hoster gefunden')
            return Promise.reject()
          }
          const hostdiv = $('#Hoster_' + kinoxHost.id)
          const data = hostdiv.children('.Data').html()
          console.log(kinoxHost, hostdiv, data)
          const match = data.match(/<b>Mirror<\/b>: (?:(\d+)\/(\d+))<br ?\/?><b>Vom<\/b>: (\d\d\.\d\d\.\d{4})/)
          if (!match) return console.log(data)
          let [, initialindex, mirrorcount, date] = match
          console.log(initialindex, mirrorcount, date)
          const filename = (hostdiv.attr('rel').match(/^(.*?)\&/) || [])[1]
          console.log(filename)
          const getMirror = mirrorindex => this.bot.fetch(hostname + '/aGET/Mirror/' + filename, {
            headers,
            cloud: true,
            json: true,
            qs: {
              Hoster: kinoxHost.id,
              Mirror: mirrorindex
            }
          }).then(({ body }) => {
            if (!body.Stream) return console.error(kinoxHost.provider) // || !body.Replacement
            const mirrorurl = 'https://' + (body.Stream.match(/\/\/([^"]+?)"/) || [])[1]
            let match
            if (body.Replacement) {
              match = body.Replacement.match(/<b>Mirror<\/b>: (?:(\d+)\/(\d+))<br ?\/?><b>Vom<\/b>: (\d\d\.\d\d\.\d{4})/)
              if (!match) return console.log(body.Replacement)
              mirrorindex = match[1]
              mirrorcount = match[2]
              date = match[3]
              console.log(match[0], mirrorindex, mirrorcount, date)
            }
            this.bot.sendMessage('Addiere Mirror ' + mirrorindex + '/' + mirrorcount + ': ' + mirrorurl + ' Vom: ' + date)
            this.matchUrl(mirrorurl, [kinoxHost.provider])
            return this.getInfo().then(result => {
              result.title = title
              return result
            }, () => (mirrorindex != initialindex) ? getMirror(mirrorindex) : getHost())
          })
          return getMirror(initialindex)
        }
        return getHost()
      })
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
      if (!e) return
      this.fileurl = e.src
      return this
    }
  },
  'vshare.io': {
    regex: 'VShareIE',
    userScript: function() {
      const e = document.querySelector('video').firstElementChild || document.querySelector('video')
      if (!e) return
      this.fileurl = e.src
      return this
    }
  },
  'vivo.sx': {
    regex: 'VivoIE',
    userScript: function() {
      const e = document.querySelector('video').lastElementChild || document.querySelector('video')
      if (!e) return
      if (e.paused) return
      this.fileurl = e.src
      return this
    }
  },
  'nxload.com': {
    regex: /https?:\/\/(?:www\.)?nxload\.com\/(?:(?:embed-([^/?#&]+)\.html)|(?:(?:embed\/)?([^/?#&]+)(?:\.html)?))/,
    groups: ['id'],
    getInfo() {
      this.match(this.url.replace(/embed-/i, '').replace(/\.html$/, ''))
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
      this.match(this.url.replace(/embed-/i, '').replace(/\.html$/, ''))
      return this.bot.fetch(this.url, {
        match: /<title>([^<]*) - Onlystream.tv<\/title>[\s\S]+sources:\s\[\{file:"([^"]+)/
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
      this.match(this.url.replace(/embed-/i, '').replace(/\.html$/, ''))
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
      if (!e) return
      this.fileurl = pData.sourcesCode[0].src
      return this
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
        console.log(this.match, timestamp)
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
