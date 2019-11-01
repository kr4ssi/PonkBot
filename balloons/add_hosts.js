'use-scrict';

const { execFile } = require('child_process')
const path = require('path')
const URL = require('url')
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();

module.exports = class HosterList {
  constructor(ponk, ydlRegEx) {
    class Hoster {
      constructor(name, rules = {}) {
        Object.assign(this, {
          name,
          regex: new RegExp('^https?:\\/\\/([-\\w]+\\.)*' + name.replace('.', '\\.') + '\\/.+'),
          needManifest: rules.needManifest || typeof rules.userScript === 'function',
          needUserScript: typeof rules.userScript === 'function',
          match(url) {
            const host = this
            class HostMatch {
              constructor(match) {
                this.url = match[0]
                Object.assign(this, host, {
                  match,
                  getInfo: host.getInfo.bind(this, this.url, this),
                  info: {
                    webpage_url: this.url
                  },
                })
              }
              get id() {
                return this.fileurl
              }
              get manifest() {
                return {
                  title: this.title,
                  live: false,
                  duration: 0,
                  sources: [
                    {
                      url: this.fileurl,
                      quality: 720,
                      contentType: 'application/x-mpegURL'
                    }
                  ]
                }
              }
            }
            const match = url.match(host.regex)
            return match ? new HostMatch(match) : false
          }
        }, rules)
      }
      getInfo(url) {
        return new Promise((resolve, reject) => {
          execFile('./youtube-dl/youtube-dl', ['--dump-json', '-f', 'best', '--restrict-filenames', url], {
            maxBuffer: 104857600
          }, (err, stdout, stderr) => {
            let info
            try {
              if (err) {
                ponk.sendMessage(url + ' ' + (err.message && err.message.split('\n').filter(line => /^ERROR: /.test(line)).join('\n')))
                return reject(err)
              }
              let data = stdout.trim().split(/\r?\n/)
              info = data.map((rawData) => JSON.parse(rawData))
            }
            catch (err) {
              return console.error(err)
            }
            console.log(manifest)
            if (!info.title) info = info[0];
            this.title = (new RegExp('^' + info.extractor_key, 'i')).test(info.title) ? info.title : (info.extractor_key + ' - ' + info.title)
            this.fileurl = info.url.replace(/^http:\/\//i, 'https://')
            console.log(this)
            if (!this.needManifest) return resolve({
              title: this.title,
              url: fileurl,
              host: this,
              info
            })
            const manifest = this.manifest
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
              host: this
            })
          })
        })
      }
    }
    const allowedHosts = Object.entries({
      'kinox.to': {
        regex: /https?:\/\/(?:www\.)?kino(?:[sz]\.to|x\.(?:tv|me|si|io|sx|am|nu|sg|gratis|mobi|sh|lol|wtf|fun|fyi|cloud|ai|click|tube|club|digital|direct|pub|express|party|space))\/(?:Tipp|Stream\/.+)\.html/,
        allowedHosts: this,
        getInfo(url, host, gettitle) {
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
                //getprop: 'Stream',
                //match: /\/\/([^"]+?)"/
              }).then(({ body }) => {
                if (!body.Stream) return console.error(host.host)
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
                  return {
                    ...result,
                    manifest: {
                      ...result.manifest,
                      title
                    }
                  }
                }, () => (mirrorindex != initialindex) ? getMirror(mirrorindex) : getHost())
              })
              return getMirror(initialindex)
            }
            return getHost()
          })
        }
      },
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
        regex: /https?:\/\/(?:www\.)?vidoza\.net\/(?:(?:embed-([^/?#&]+)\.html)|(?:([^/?#&]+)(?:\.html)?))/,
        groups: ['id'],
        getInfo(url, host) {
          return ponk.fetch(url, {
            match: /([^"]+\.mp4)[\s\S]+vid_length: '([^']+)[\s\S]+curFileName = "([^"]+)/
          }).then(({ match }) => {
            this.title = match[3]
            this.fileurl = match[1]
            const manifest = this.manifest
            manifest.duration = parseInt(match[2])
            manifest.sources[0].contentType = 'video/mp4';
            return this
          })
        },
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
        getInfo(url, host) {
          return ponk.fetch(url, {
            match: /<title>([^<]+)[\s\S]+<source src="([^"]+)"/
          }).then(({ match }) => ({
            manifest: this.manifest(match[1], match[2]),
            info: {
              webpage_url: url
            },
            host
          }))
        },
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
      'gounlimited.to': {
        getInfo(url) {
          return ponk.fetch(url.replace(/embed-/i, '').replace(/\.html$/, ''), {
            match: /Watch ([^<]*)[\s\S]+mp4\|(.*)\|(.*)\|sources/
          }).then(({ match }) => {
            this.title = match[1] || 'GoUnlimited'
            this.fileurl = 'https://' + match[3] + '.gounlimited.to/' + match[2] + '/v.mp4'
            const manifest = this.manifest
            manifest.sources[0].contentType = 'video/mp4';
            return this
          })
        },
        kinoxids: ['84'],
        priority: 1,
        needManifest: true
      },
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
          return {
            manifest: this.manifest('Kein Livestream', url),
            host,
          }
        }
      },
      'nxload.com': {
        getInfo(url) {
          return ponk.fetch(url.replace(/embed-/i, '').replace(/\.html$/, ''), {
            match: /title: '([^']*)[\s\S]+\|(.+)\|hls\|(.+)\|urlset/
          }).then(({ match }) => ({
            manifest: this.manifest(match[1] || 'NxLoad', 'https://' + match[2] + '.nxload.com/hls/' + match[3].replace(/\|/g, '-') + ',,.urlset/master.m3u8'),
            host: this,
          }))
        }
      }
    }).map(([name, rules]) => ([
      name, {
        ...rules,
        needManifest: true
      }
    ]))).map(([name, rules = {}]) => {
      return new Hoster(name, rules)
    })
    const userScriptHosts = allowedHosts.filter(host => host.needUserScript)

    //const hosts = $('#HosterList').children().map((i, e) => (e.attribs.id.match(/_(\d+)/) || [])[1]).toArray()
    //.map(id => ({ id, host: allowedHosts.find(host => host.kinoxids && host.kinoxids.includes(id))}))
    //.filter(host => host.host).sort((a, b) => a.host.priority - b.host.priority)

    this.kinoxHosts = allowedHosts.filter(host => host.kinoxids && host.kinoxids.length > 0).sort((a, b) => a.priority - b.priority)
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
    this.allowedHostsString = allowedHosts.map(host => host.name).join(', ')
  }
}
