/*!
**|   PonkBot C3-Manifests
**@
*/

'use strict';

const CyTubeClient = require('../lib/client.js')

class C3Manifests extends Array {
  constructor(ponk) {
    super()
    Object.assign(this, {
      base        : 'https://streaming.media.ccc.de/',
      event       : 'rc3',
      bot         : ponk
    })
    this.bot.fetch(this.base + this.event, {
      $: true
    }).then(({ $ }) => Promise.all($('.panel.panel-default').map((i, e) => {
      const path = $(e).parent().attr('href')
      return this.bot.fetch(this.base + path, {
        $: true,
        match: /<title>([^<]+)/
      }).then(({ $, match }) => ({ $, match, path }))
    }).toArray())).then(results => results.forEach(({ $, match, path }) => {
      const title = match[1]
      const urls = $('a').filter((i, e) => /\.(?:mpd|m3u8)$/.test(e.attribs.href)).map((i, e) => e.attribs.href).toArray()
      this.bot.server.host.get('/' + path + '.json', (req, res) => {
        res.json({
          title,
          live: true,
          duration: 0,
          sources: urls.map(url => {
            let quality = 720
            let contentType = 'application/x-mpegURL'
            if (url.endsWith('manifest.mpd')) contentType = 'application/dash+xml'
            else if (url.endsWith('native_hd.m3u8')) quality = 1080
            else if (url.endsWith('translated_hd.m3u8')) quality = 540
            else if (url.endsWith('translated_sd.m3u8')) quality = 480
            else if (url.endsWith('translated-2_hd.m3u8')) quality = 360
            else if (url.endsWith('translated-2_sd.m3u8')) quality = 240
            return {
              contentType,
              quality,
              url
            }
          }).filter(source => !source.url.includes('translated'))
        })
      })
      this.push(this.bot.server.weblink + '/' + path + '.json')
    }))
  }
}

module.exports = {
  meta: {
    active: true,
    type: 'giggle'
  },
  giggle(ponk){
    return new Promise((resolve, reject)=>{
      ponk.API.c3Manifests = new C3Manifests(ponk)
      ponk.logger.log('Registering rC3')
      resolve()
    })
  },
  handlers: {
    c3: function(user, params, meta) {
      const c3Manifests = this.API.c3Manifests
      if (params != 'keller') c3Manifests.forEach(id => {
        if (this.playlist.some(item => item.media.id === id)) return
        console.log(id)
        this.mediaSend({ type: 'cm', id })
      })
      else {
        const { host, port, secure, user, auth } = this.client
        const tempclient = new CyTubeClient({
          host, port, secure, user, auth, chan: 'keller'
        }, this.log).once('ready', () => {
          tempclient.connect()
        }).once('connected', () => {
          tempclient.socket.emit = this.client.socket.emit.bind(tempclient.socket)
          tempclient.start()
        }).once('started', () => {
          tempclient.playlist()
        }).once('playlist', playlist => {
          c3Manifests.forEach(id => {
            if (playlist.some(item => item.media.id === id)) return
            tempclient.socket.emit('queue', {
              type: 'cm',
              id,
              pos: 'end',
              temp: true,
              duration: 0,
            });
          })
          setTimeout(() => tempclient.socket.close(), 3000)
        }).on('error', error => console.log(error))
      }
    },
    fahrplan: function(user, params, meta) {
      this.fetch(this.API.c3Manifests.base + this.API.c3Manifests.event, {
        $: true
      }).then(({ $ }) => {
        $('.panel-body:has(img' + (params ? ('[alt^=\'' + params + '\' i]') : '') + ')').each((i, panel) => {
          const name = $(panel).find('img').attr('alt')
          const curr = $(panel).find('.current-talk strong').text() + ' ' + $(panel).find('.current-talk span').text()
          const next = $(panel).find('.next-talk strong').text() + ' ' + $(panel).find('.next-talk span').text()
          this.sendMessage(name + ' - ' + curr + ' - ' + next)
        })
      })
    }
  }
}
