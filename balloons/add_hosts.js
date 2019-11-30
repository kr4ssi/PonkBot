'use-scrict';

const { execFile } = require('child_process')
const path = require('path')
const URL = require('url')
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();

const parseLink = require('./parselink.js')

class HosterList {
  constructor(ponk, ydlRegEx) {
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
      match(url) {
        const match = url.match(this.regex)
        class HostMatch {
          constructor(host) {
            this.url = match[0]
            Object.assign(this, host, {
              match,
              //fileurl,
              //title,
              //duration,
              //quality,
              //thumbnail,
              //live,
              ffprobe: {},
              info: {},
              //timestamp,
              //user: {},
              getInfo: host.getInfo.bind(this, this.url)
            })
            this.matchGroup = id => this.match[this.groups.indexOf(id) + 1]
          }
          get id() {
            return this.type === 'cm' ? (ponk.server.weblink + '/add.json?' + (this.needUserScript ? 'userscript&' : '') + 'url=' + this.url) : this.fileurl
          }
          get manifest() {
            return {
              title: this.title || this.url,
              live: this.live || false,
              duration: this.duration,
              thumbnail: this.thumbnail,
              sources: [
                {
                  url: this.needUserScript ? ponk.server.weblink + '/redir?url=' + this.url : this.fileurl,
                  quality: [240, 360, 480, 540, 720, 1080, 1440].includes(this.quality) ? this.quality : 720,
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
                }
              ]
            }
          }
        }
        return match && new HostMatch(this)
      }
      getInfo(url) {
        return new Promise((resolve, reject) => {
          execFile('./youtube-dl/youtube-dl', ['--dump-json', '-f', 'best', '--restrict-filenames', url], {
            maxBuffer: 104857600
          }, (err, stdout, stderr) => {
            if (err) {
              ponk.sendMessage(url + ' ' + (err.message && err.message.split('\n').filter(line => /^ERROR: /.test(line)).join('\n')))
              return reject(err)
            }
            let info
            try {
              let data = stdout.trim().split(/\r?\n/)
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
            this.title = (new RegExp('^' + this.info.extractor_key, 'i')).test(info.title) ? info.title : (info.extractor_key + ' - ' + info.title)
            this.fileurl = info.url.replace(/^http:\/\//i, 'https://')
            if (this.type != 'cm') return resolve(this)
            if (info.manifest_url) this.fileurl = info.manifest_url.replace(/^http:\/\//i, 'https://')
            if (info.thumbnail && info.thumbnail.match(/^https?:\/\//i)) this.thumbnail = info.thumbnail.replace(/^http:\/\//i, 'https://')
            this.duration = info.duration
            this.quality = info.width;
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
            const hosts = sortedIds.map(id => ({ id, host: this.allowedHosts.kinoxHosts.find(host => host.kinoxids.includes(id)) }))
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
                return host.host.match(mirrorurl).getInfo().then(result => {
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
      'gounlimited.to, tazmovies.com': {
        regex: /https?:\/\/(?:www\.)?(gounlimited\.to|tazmovies\.com)\/(?:(?:embed-([^/?#&]+)\.html)|(?:([^/?#&]+)(?:\.html)?))/,
        groups: ['host', 'id'],
        getInfo() {
          this.url = this.url.replace(/embed-/i, '').replace(/\.html$/, '')
          return ponk.fetch(this.url, {
            match: /Watch ([^<]*)/,
            unpack: /sources:\["([^"]+)/
          }).then(({ match, unpack }) => {
            this.title = match[1]
            this.fileurl = unpack[1]
            console.log(this)
            return this
          })
        },
        kinoxids: ['84'],
        priority: 1,
        type: 'cm'
      },
      'nxload.com': {
        regex: /https?:\/\/(?:www\.)?nxload\.com\/(?:(?:embed-([^/?#&]+)\.html)|(?:(?:embed\/)?([^/?#&]+)(?:\.html)?))/,
        groups: ['id'],
        getInfo() {
          this.url = this.url.replace(/embed-/i, '').replace(/\.html$/, '')
          return ponk.fetch(this.url, {
            match: /title: '([^']*)/,
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
        regex: /https?:\/\/(?:www\.)?vidoza\.net\/(?:(?:embed-([^/?#&]+)\.html)|(?:([^/?#&]+)(?:\.html)?))/,
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
      'clipwatching.com': {
        regex: /https?:\/\/(?:www\.)?(clipw\.live|clipwatching\.com)\/(?:(?:embed-([^/?#&]+)\.html)|(?:([^/?#&]+)(?:\.html)?))/,
        groups: ['host', 'id'],
        getInfo() {
          this.url = this.url.replace(/embed-/i, '').replace(/\.html$/, '')
          return ponk.fetch(this.url, {
            match: /<title>Watch ([^<]*)[\s\S]+sources: \[{src: "([^"]+)/
          }).then(({ match }) => {
            this.title = match[1]
            this.fileurl = match[2]
            return this
          })
        },
        kinoxids: ['87'],
        priority: 3,
        userScript: function() {
          const e = document.querySelector('video').lastElementChild || document.querySelector('video')
          if (!e) return
          this.fileurl = e.src
          return this
        }
      },
      'youtube.com': {
        ...ydlRegEx['YoutubeIE'],
        type: 'yt',
        fikuonly: true,
        getInfo() {
          this.fileurl = this.match[2]
          console.log(this.match, this.match[0].match(/[?&](?:t|timestamp)=(\d+)/))
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
      'vimeo.com': {
        ...ydlRegEx['DailymotionIE'],
        type: 'vi',
        fikuonly: true,
        getInfo() {
          this.fileurl = this.matchGroup('id')
          return Promise.resolve(this)
        }
      },
      'dailymotion.com': {
        ...ydlRegEx['VimeoIE'],
        type: 'dm',
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
      'archive.org': {},
      'ccc.de': {},
      'bitchute.com': {},
      'prosieben.de': ydlRegEx['ProSiebenSat1IE'],
      'peertube': ydlRegEx['PeerTubeIE']
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
        }
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

    //const hosts = $('#HosterList').children().map((i, e) => (e.attribs.id.match(/_(\d+)/) || [])[1]).toArray()
    //.map(id => ({ id, host: allowedHosts.find(host => host.kinoxids && host.kinoxids.includes(id))}))
    //.filter(host => host.host).sort((a, b) => a.host.priority - b.host.priority)

    this.kinoxHosts = allowedHosts.filter(host => host.kinoxids && host.kinoxids.length > 0 && !host.down).sort((a, b) => a.priority - b.priority)
    this.kinoxIds = this.kinoxHosts.reduce((arr, host) => arr.concat(host.kinoxids || []), [])

    console.log(this.kinoxHosts, this.kinoxIds)

    this.hostAllowed = url => new Promise((resolve, reject) => {
      if (!allowedHosts.find(host => {
        const hostMatch = host.match(url)
        return hostMatch && resolve(hostMatch) && true
      })) reject()
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
    //+ '. Hoster down: ' + allowedHosts.filter(host => host.down).map(host => host.name).join(', ')
  }
}
module.exports =  HosterList


/*
'verystream.com, woof.tube': {
...ydlRegEx['VerystreamIE'],
kinoxids: ['85'],
priority: 1,
userScript: () => {
const e = document.querySelector("[id^=videolink]")
if (!e) return
link += `/gettoken/${e.textContent}?mime=true`
return true
},
down: true
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
},
down: true
},
'rapidvideo.com, bitporno.com': {
regex: /https?:\/\/(?:www\.)?((?:rapidvideo|bitporno)\.com)\/[ve]\/([^/?#&])+/,
groups: ['host', 'id'],
getInfo(url) {
return ponk.fetch(url, {
match: /<title>([^<]+)[\s\S]+<source src="([^"]+)"/
}).then(({ match }) => {
this.title = match[1]
this.fileurl = match[2]
return this
})
},
kinoxids: ['71', '75'],
priority: 4,
userScript: () => {
const e = document.querySelector('video').lastElementChild || document.querySelector('video')
if (!e) return
link = e.src
return true
},
down: true
},
'streamango.com, fruithosts.net, streamcherry.com': {
...ydlRegEx['StreamangoIE'],
kinoxids: ['72', '82'],
priority: 5,
userScript: () => {
const e = document.querySelector("[id^=mgvideo_html5_api]")
if (!e) return
return e.src
},
down: true
},*/
