/*!
**|   PonkBot C3
**@
*/

'use strict';

const CyTubeClient = require('../lib/client.js')
const crypto = require('crypto')

class C3 extends Array {
  constructor(ponk) {
    super()
    Object.assign(this, {
      base        : 'https://streaming.media.ccc.de/rc3'
    })
    ponk.fetch(this.base, {
      $: true
    }).then(({ $ }) => $('.roomtitle.regular').each((i, e) => {
      const room = $(e).parent().parent().parent().parent().attr('href').split('/').pop()
      const id = `<iframe src="${this.base}/embed/${room}/dash/native"></iframe>`
      this.push({
        media: {
          id,
          type: 'cu',
          title: $(e).text(),
          pos: 'end',
          temp: true,
        },
        rid: 'cu:' + crypto.createHash("sha256").update(id).digest("base64")
      })
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
      ponk.API.c3 = new C3(ponk)
      ponk.logger.log('Registering C3')
      resolve()
    })
  },
  handlers: {
    c3: function(user, params, meta) {
      if (params != 'keller') this.API.c3.forEach(({ media, rid }) => {
        if (this.playlist.some(item => item.media.id === rid)) return
        console.log(media)
        this.mediaSend(media)
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
          this.API.c3.forEach(({ media, rid }) => {
            if (playlist.some(item => item.media.id === rid)) return
            tempclient.socket.emit('queue', media)
          })
          setTimeout(() => tempclient.socket.close(), 15000)
        }).on('errorMsg', error => console.log(error)).on('queueFail', error => console.log(error)).on('error', error => console.log(error))
      }
    },
    fahrplan: function(user, params, meta) {
      this.fetch(this.API.c3.base, {
        $: true
      }).then(({ $ }) => {
        $('.panel-body:has(img' + (params ? ('[alt^=\'' + params + '\' i]') : '') + ')').each((i, panel) => {
          const name = $(panel).find('img').attr('alt')
          const curr = $(panel).find('.current-talk strong').text() + ' ' + $(panel).find('.current-talk span').text()
          const next = $(panel).find('.next-talk strong').text() + ' ' + $(panel).find('.next-talk span').text()
          this.sendMessage(`${name} - ${curr}\n${next}`)
        })
      })
    }
  }
}
