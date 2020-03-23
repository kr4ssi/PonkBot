/*!
**|   PonkBot gez
**@
*/

'use strict';

const CyTubeClient = require('../lib/client.js');

const path = require('path')
const URL = require('url')

class GezStations {
  constructor(ponk) {
    Object.assign(this, {
      manifests   : [],    // Manifests
      bot         : ponk   // The bot
    })
  }
  setupManifests() {
    return new Promise((resolve, reject) => {
      this.bot.fetch('https://www.ardmediathek.de/ard/live/Y3JpZDovL2Rhc2Vyc3RlLmRlL0xpdmVzdHJlYW0tRGFzRXJzdGU', {
        $: true
      }).then(({ $ }) => {
        const stations = $('.button._focusable').filter((i, e) => {
          return /devicetype=pc/.test(e.attribs.href)
        })
        Promise.all(stations.map((i, e) => {
          const url = 'https://www.ardmediathek.de' + e.attribs.href
          const addition = this.bot.API.add.add(url, null, { gettitle: true })
          return addition.getInfo()//.then(() => Object.assign(addition, {
            //formats: addition.formats.filter(format => {
            //  if (/hr/.test(e.attribs.title)) return !/sub/.test(format.url)
            //  return (format.manifest_url === addition.info.manifest_url)
            //}),
            //live: true,
            //title: e.attribs.title.replace(' im Livestream', '')
          //}))
          .catch(console.error)
        }).toArray().concat([
          'https://www.zdf.de/sender/zdf/zdf-live-beitrag-100.html',
          'https://www.zdf.de/sender/zdfneo/zdfneo-live-beitrag-100.html',
          'https://www.zdf.de/dokumentation/zdfinfo-doku/zdfinfo-live-beitrag-100.html'
        ].map(url => {
          const addition = this.bot.API.add.add(url, null, { gettitle: true })
          return addition.getInfo()//.then(() => Object.assign(addition, {
            //title: addition.info.title.replace(' Livestream', '')
          //}))
          .catch(console.error)
        }))).then(results => {
          results.forEach(({ manifest, title } = {}) => {
            if (!manifest) return
            console.log(title)
            const filepath = `/mediathek/${encodeURIComponent(title)}.json`
            this.bot.server.host.get(filepath, (req, res) => {
              res.json(manifest)
            })
            this.manifests.push({
              title,
              id: this.bot.server.weblink + filepath
            })
          })
          resolve()
        }).catch(console.error)
      })
    })
  }
}

module.exports = {
  meta: {
    active: true,
    type: 'giggle'
  },
  giggle(ponk){
    return new Promise((resolve, reject) => {
      ponk.API.gez = new GezStations(ponk);
      ponk.logger.log('Registering GEZ-Stations');
      resolve();
    })
  },
  handlers: {
    gez(user, params, meta) {
      let chan
      if (/keller$/.test(params)) {
        chan = 'keller'
        params = params.split(' ').slice(0, -1).join(' ')
      }
      Promise.resolve().then(() => {
        if (!this.API.gez.manifests.length)
        return this.API.gez.setupManifests()
      }).then(() => {
        let gezmanifests = this.API.gez.manifests
        if (params != 'alle') {
          let gezmanifest
          if (params) gezmanifest = gezmanifests.find(({ title }) => (new RegExp('^' + params, 'i')).test(title))
          else gezmanifest = gezmanifests[Math.floor(Math.random() * gezmanifests.length)]
          if (!gezmanifest) return this.sendMessage('Kein Sender gefunden')
          gezmanifests = [gezmanifest]
        }
        if (!chan) gezmanifests.forEach(({ id }) => {
          if (this.playlist.some(item => item.media.id === id)) return
          this.mediaSend({ type: 'cm', id })
        })
        else if (meta.rank > 2) {
          const { host, port, secure, user, auth } = this.client
          const tempclient = new CyTubeClient({
            host, port, secure, user, auth, chan
          }, this.log).once('ready', function() {
            this.connect()
          }).once('connected', function() {
            this.start()
          }).once('started', function() {
            this.playlist()
          }).once('playlist', function(playlist) {
            gezmanifests.forEach(({ id }, i) => {
              if (playlist.some(item => item.media.id === id)) return
              setTimeout(() => this.socket.emit('queue', {
                type: 'cm',
                id,
                pos: 'end',
                temp: true,
                duration: 0,
              }), i * 200)
            })
            setTimeout(() => this.socket.close(), gezmanifests.length * 300)
          }).on('error', error => console.log(error))
        }
      })
    },
    tv(user, params, meta) {
      const getZDF = (params = '') => this.fetch('https://www.zdf.de/live-tv', {
        $: true
      }).then(({ $ }) => {
        let station = $('section[class^=\'b-epg-timeline timeline-' + params + '\' i]')
        if (!station.length) return this.sendMessage('Kein Sender gefunden')
        station.each((i, station) => {
          station = $(station)
          if (!/^b-epg-timeline timeline-ZDF/.test(station.attr('class'))) return false
          const name = station.find('h3').text().replace(' Programm', '')
          station = station.find('ul li:has(.live-tag) a')
          this.fetch('https://www.zdf.de/' + JSON.parse(station.attr('data-dialog')).contentUrl, {
            $: true
          }).then(({ $ }) => {
            const title = $('.teaser-title').text().trim()
            const subtitle = $('.overlay-subtitle').text().trim()
            const date = $('.overlay-link-time').text().trim()
            this.sendMessage(name + ' - ' + date + ': ' + title + (subtitle ? ' - ' + subtitle : ''))
          })
        })
      })
      if (/^ZDF/i.test(params)) return getZDF(params)
      this.fetch('https://programm.ard.de/TV/Programm/Alle-Sender', {
        $: true
      }).then(({ $ }) => {
        let station = $('li[data-action=\'Sendung\']:has(span[data-click-pixel^=\'Livestream::' + params + '\' i])')
        if (!station.length) return this.sendMessage('Kein Sender gefunden')
        station.each((i, station) => {
          station = $(station)
          const name = station.attr('data-click-pixel').slice('Detailansicht::'.length)
          const title = station.find('.title').contents()[0].nodeValue.trim()
          const subtitle =  station.find('.subtitle').text().trim()
          const date =  station.find('.date').text().trim()
          const enddate =  station.next().find('.date').text().trim()
          this.sendMessage(name + ' - ' + date + ' - ' + enddate + ' Uhr: ' + title + ' - ' + subtitle)
        })
      }).then(params ? undefined : getZDF)
    },
    doku(user, params, meta) {
      this.fetch('https://mediathekviewweb.de/api/query', {
        method: 'post',
        json: false,
        jsonparse: true,
        getprop: 'result',
        getlist: 'results',
        headers: {
          "content-type": "text/plain"
        },
        body: JSON.stringify({
          queries: [
            {
              fields: [
                'title',
                'topic'
              ],
              query: params
            }
          ],
          sortBy: 'timestamp',
          sortOrder: 'desc',
          future: false,
          offset: 0,
          size: 2
        })
      }).then(({ list }) => {
        console.log(list)
        let body = list.shift()
        if (body.title.endsWith('(Hörfassung)')) body = list.shift()
        const title = body.topic + ' - ' + body.title
        this.API.add.cmAdditions[this.API.add.fixurl(body.url_website)] = {
          manifest: {
            title,
            live: false,
            duration: body.duration,
            sources: [body.url_video_low, body.url_video, body.url_video_hd].map((url, i) => ({
              url,
              quality: [360, 480, 720][i],
              contentType: ([
                {type: 'video/mp4', ext: ['.mp4']},
                {type: 'video/webm', ext: ['.webm']},
                {type: 'application/x-mpegURL', ext: ['.m3u8']},
                {type: 'video/ogg', ext: ['.ogv']},
                {type: 'application/dash+xml', ext: ['.mpd']},
                {type: 'audio/aac', ext: ['.aac']},
                {type: 'audio/ogg', ext: ['.ogg']},
                {type: 'audio/mpeg', ext: ['.mp3', '.m4a']}
              ].find(contentType => contentType.ext.includes(path.extname(URL.parse(url).pathname))) || {}).type || 'video/mp4'
            }))
          }
        }
        this.mediaSend({ type: 'cm', id: this.server.weblink + '/add.json?' + 'url=' + encodeURIComponent(this.API.add.fixurl(body.url_website)), pos: meta.addnext ? 'next' : 'end' })
        this.sendMessage(title + ' addiert')
      })
    }
  }
}
