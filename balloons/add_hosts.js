'use-scrict';

const EventEmitter = require('events')
const { PythonShell } = require('python-shell')
const path = require('path')
const URL = require('url')
const fs = require('fs')
const Entities = require('html-entities').AllHtmlEntities
const entities = new Entities();

const parseLink = require('./parselink.js')

class HosterList {
  constructor(ponk, ydlRegEx) {
    class Addition extends EventEmitter {
      constructor(url, hosterList = allowedHosts) {
        super()
        const host = hosterList.find(host => {
          this.match = url.match(host.regex)
          return !!this.match
        })
        if (!host) throw new Error('Kann ' + url + ' nicht addieren. Addierbare Hosts: ' + this.allowedHostsString)
        this.url = this.match[0]
        Object.assign(this, host, {
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
          getInfo: host.getInfo.bind(this, this.url)
        })
        this.matchGroup = id => this.match[this.groups.indexOf(id) + 1]
      }
      get id() {
        return this.type === 'cm' ? (ponk.server.weblink + '/add.json?' + (this.needUserScript ? 'userscript&' : '') + 'url=' + this.url) : this.fileurl
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
            url: this.needUserScript ? ponk.server.weblink + '/redir?url=' + this.url : url.replace('http://', 'https://'),
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
      download(url) {
        if (ponk.downloading) return ponk.sendMessage('ladiert schon 1')
        ponk.downloading = true
        let progress
        let timer
        let infofilename
        new PythonShell('youtube_dl', {
          cwd: path.join(__dirname, '..', 'youtube-dl'),
          pythonOptions: ['-m'],
          args: [
            '-o', path.join(ponk.API.keys.filepath, '%(title)s-%(id)s.%(ext)s'),
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
          if (!message.startsWith('[download]')) return ponk.sendMessage(message)
          progress = message
          if (!timer) timer = setInterval(() => ponk.sendMessage(progress), 10000)
        }).on('close', () => {
          clearInterval(timer)
          ponk.downloading = false
          console.log('closed')
          const info = JSON.parse(fs.readFileSync(infofilename))
          const filename = path.basename(info._filename)
          fs.chmodSync(infofilename, 644)
          ponk.sendMessage(filename + ' wird addiert')
          ponk.addNetzm(ponk.API.keys.filehost + '/files/' + filename, false, ponk.name, 'fi', info.title)
        }).on('error', err => {
          clearInterval(timer)
          ponk.downloading = false
          console.error(err)
        })
      }
    }
    class Hoster {
      constructor(name, rules = {}) {
        Object.assign(this, {
          name,
          regex: new RegExp('^https?:\\/\\/([-\\w]+\\.)*' + name.replace('.', '\\.') + '\\/.+'),
          groups: [],
          type: rules.type || (typeof rules.userScript === 'function' ? 'cm' : 'fi'),
          needUserScript: typeof rules.userScript === 'function'
        }, rules)
      }
      getInfo(url, moreargs = []) {
        return new Promise((resolve, reject) => {
          PythonShell.run('youtube_dl', {
            cwd: path.join(__dirname, '..', 'youtube-dl'),
            pythonOptions: ['-m'],
            args: ['--dump-json', '-f', 'best', '--restrict-filenames', ...moreargs,  url]
          }, (err, data) => {
            if (err) {
              ponk.sendMessage(url + ' ' + (err.message && err.message.split('\n').filter(line => /^ERROR: /.test(line)).join('\n')))
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
            if (info.extractor === 'youtube') {
              this.type = 'yt'
              this.fileurl = info.display_id
              return resolve(this)
            }
            if (info.formats && info.formats.length) this.formats = info.formats.filter(format => [240, 360, 480, 540, 720, 1080, 1440].includes(format.height))
            this.title = (new RegExp('^' + this.info.extractor_key, 'i')).test(info.title) ? info.title : (info.extractor_key + ' - ' + info.title)
            this.fileurl = info.url.replace(/^http:\/\//i, 'https://')
            if (this.type != 'cm') return resolve(this)
            if (info.manifest_url) this.fileurl = info.manifest_url.replace(/^http:\/\//i, 'https://')
            if (info.thumbnail && info.thumbnail.match(/^https?:\/\//i)) this.thumbnail = info.thumbnail.replace(/^http:\/\//i, 'https://')
            this.duration = info.duration
            this.quality = info.height;
            return resolve(this)
          })
        })
      }
    }
    const allowedHosts = Object.entries({
      'kinox.to': {
        regex: /https?:\/\/(?:www\.)?kino(?:[sz]\.to|x\.(?:tv|me|si|io|sx|am|nu|sg|gratis|mobi|sh|lol|wtf|fun|fyi|cloud|ai|click|tube|club|digital|direct|pub|express|party|space))\/(?:Tipp|Stream\/.+)\.html/,
        allowedHosts: this,
        getInfo(url, gettitle) {
          return ponk.fetch(url, {
            cloud: true,
            match: /<title>(.*) Stream/,
            $: true
          }).then(({ match, $, headers }) => {
            const hostname = 'https://' + URL.parse(url).hostname
            const location = hostname + $('.Grahpics a').attr('href')
            if (/\/Tipp\.html$/.test(url)) ponk.sendMessage('Addiere: ' + location)
            const title = entities.decode(match[1])
            if (gettitle) return { title, location }
            const hosterIds = $('#HosterList').children().map((i, e) => (e.attribs.id.match(/_(\d+)/) || [])[1]).toArray()
            const sortedIds = this.allowedHosts.kinoxIds.filter(id => {
              const includes = hosterIds.includes(id)
              if (includes) {
                return true
              }
            })
            const hosts = sortedIds.map(id => ({ id, host: this.allowedHosts.fromKinoxId(id) }))
            console.log(hosts)
            const getHost = () => {
              let host = hosts.shift()
              if (!host) {
                ponk.sendMessage('Kein addierbarer Hoster gefunden')
                return Promise.reject()
              }
              const hostdiv = $('#Hoster_' + host.id)
              const data = hostdiv.children('.Data').html()
              console.log(host, hostdiv, data)
              const match = data.match(/<b>Mirror<\/b>: (?:(\d+)\/(\d+))<br ?\/?><b>Vom<\/b>: (\d\d\.\d\d\.\d{4})/)
              if (!match) return console.log(data)
              let [, initialindex, mirrorcount, date] = match
              console.log(initialindex, mirrorcount, date)
              const filename = (hostdiv.attr('rel').match(/^(.*?)\&/) || [])[1]
              console.log(filename)
              const getMirror = mirrorindex => ponk.fetch(hostname + '/aGET/Mirror/' + filename, {
                headers,
                cloud: true,
                json: true,
                qs: {
                  Hoster: host.id,
                  Mirror: mirrorindex
                }
              }).then(({ body }) => {
                if (!body.Stream) return console.error(host.host) // || !body.Replacement
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
                ponk.sendMessage('Addiere Mirror ' + mirrorindex + '/' + mirrorcount + ': ' + mirrorurl + ' Vom: ' + date)
                return new Addition(mirrorurl, [host.host]).getInfo().then(result => {
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
        ...ydlRegEx['XFileShareIE'],
        getInfo() {
          if (['nxload.com', 'gounlimited.to'].includes(this.matchGroup('host'))) this.needUserScript = false
          let args = []
          if (['gounlimited.to'].includes(this.matchGroup('host'))) args = ['--no-check-certificate']
          return Hoster.prototype.getInfo.call(this, this.url, args)
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
        ...ydlRegEx['VShareIE'],
        userScript: function() {
          const e = document.querySelector('video').firstElementChild || document.querySelector('video')
          if (!e) return
          this.fileurl = e.src
          return this
        }
      },
      'vivo.sx': {
        ...ydlRegEx['VivoIE'],
        userScript: function() {
          const e = document.querySelector('video').lastElementChild || document.querySelector('video')
          if (!e) return
          this.fileurl = e.src
          return this
        }
      },
      'nxload.com': {
        regex: /https?:\/\/(?:www\.)?nxload\.com\/(?:(?:embed-([^/?#&]+)\.html)|(?:(?:embed\/)?([^/?#&]+)(?:\.html)?))/,
        groups: ['id'],
        getInfo() {
          this.url = this.url.replace(/embed-/i, '').replace(/\.html$/, '')
          return ponk.fetch(this.url, {
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
          this.url = this.url.replace(/embed-/i, '').replace(/\.html$/, '')
          return ponk.fetch(this.url, {
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
          this.url = this.url.replace(/embed-/i, '').replace(/\.html$/, '')
          return ponk.fetch(this.url, {
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
        allowedHosts: this,
        getInfo() {
          return ponk.fetch(this.url).then(({ res }) => {
            return this.allowedHosts.hostAllowed(res.request.uri.href).then(host => host.getInfo())
          })
        },
        priority: 1,
        kinoxids: ['58']
      },
      'thevideos.ga': {
        regex: /https?:\/\/((?:www\.)?thevideos\.ga)\/embed-([^.]+)\.html/,
        groups: ['host', 'id'],
        getInfo() {
          return ponk.fetch(this.url, {
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
          return ponk.fetch(this.url, {
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
        ...ydlRegEx['YoutubeIE'],
        type: 'yt',
        fikuonly: true,
        getInfo() {
          this.fileurl = this.match[2]
          const match = this.match[0].match(/[?&](?:t|timestamp)=(\d+)/)
          if (match) {
            const timestamp = match[1]
            this.on('play', () => {
              ponk.client.once('setLeader', () => {
                ponk.mediaUpdate(parseInt(timestamp, 10), false)
                process.nextTick(() => {
                  ponk.assignLeader('')
                })
              })
              ponk.assignLeader(ponk.name)
            })
            console.log(this.match, timestamp)
          }
          return Promise.resolve(this)
        }
      },
      'googledrive': {
        ...ydlRegEx['GoogleDriveIE'],
        type: 'gd',
        fikuonly: true,
        getInfo() {
          this.fileurl = this.matchGroup('id')
          return Promise.resolve(this)
        }
      },
      'dailymotion.com': {
        ...ydlRegEx['DailymotionIE'],
        type: 'dm',
        fikuonly: true,
        getInfo() {
          this.fileurl = this.matchGroup('id')
          return Promise.resolve(this)
        }
      },
      'vimeo.com': {
        ...ydlRegEx['VimeoIE'],
        type: 'vi',
        fikuonly: true,
        getInfo() {
          this.fileurl = this.matchGroup('id')
          return Promise.resolve(this)
        }
      },
      'chilloutzone.net': ydlRegEx['ChilloutzoneIE'],
      'gfycat.com': ydlRegEx['GfycatIE'],
      'liveleak.com': {},
      'imgur.com': {},
      'instagram.com': {},
      'ndr.de': {},
      'arte.tv': {},
      'bandcamp.com': {},
      'mixcloud.com': {},
      'archive.org': ydlRegEx['ArchiveOrgIE'],
      'ccc.de': {},
      'bitchute.com': {},
      'prosieben.de': ydlRegEx['ProSiebenSat1IE'],
      'peertube': ydlRegEx['PeerTubeIE'],
      'f0ck.me': {}
    }).concat(Object.entries({
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
    ]))).map(([name, rules = {}]) => {
      return new Hoster(name, rules)
    })
    const userScriptHosts = allowedHosts.filter(host => host.needUserScript)
    const kinoxIds = host => (Array.isArray(host.kinoxids) ? host.kinoxids : Object.keys(host.kinoxids))
    this.kinoxHosts = allowedHosts.filter(host => host.kinoxids && kinoxIds(host).length > 0)
    this.fromKinoxId = id => this.kinoxHosts.find(host => kinoxIds(host).includes(id))
    const kinoxPriority = id => {
      const host = this.fromKinoxId(id)
      return host && (host.priority || host.kinoxids[id])
    }
    this.kinoxIds = this.kinoxHosts.reduce((arr, host) => arr.concat(kinoxIds(host) || []), []).sort((a, b) => kinoxPriority(a) - kinoxPriority(b))
    //console.log(allowedHosts)
    this.hostAllowed = url => new Promise((resolve, reject) => {
      resolve(new Addition(url))
    })
    this.kinoxAllowed = url => new Promise((resolve, reject) => {
      resolve(new Addition(url, this.kinoxHosts))
    })
    //this.kinoxhost = id => this.kinoxHosts.find
    this.userScripts = {
      includes: userScriptHosts.map(host => host.regex),
      allowedHostsSource: userScriptHosts.map(({ regex, groups, userScript }) => ({
        regex,
        groups,
        getInfo: userScript
      }))
    }
    this.allowedHostsString = allowedHosts.filter(host => !host.fikuonly).map(host => host.name).join(', ')
  }
}
module.exports =  HosterList
