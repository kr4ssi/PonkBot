/*!
**|   PonkBot Fetch
**@
*/

'use strict';

const request = require('request')
const UserAgent = require('user-agents')

let w0bm = ''
let pr0=''
const imageHtml = (image, link) => '<a class="bild" href="' + (link || image) + '" target="_blank"><img class="image-embed-small" src="' + image + '" /></a>'

module.exports = {
  meta: {
    active: true,
    type: 'giggle'
  },
  giggle: function(ponk){
    return new Promise((resolve, reject) => {
      Object.assign(ponk, {
        fetch: function (url, { qs = {}, form = false, method = 'get', json = true, getprop = false, getlist = false, getrandom = false, match = false, customerr = [] } = {}) {
          return new Promise((resolve, reject) => {
            console.log('Fetch:', url, qs, form, method, json, getprop, getlist, getrandom, customerr)
            if ((getlist || getprop) && !json) return console.error('json must set to true')
            if (getrandom && !getlist) return console.error('getrandom from where')
            request({
              headers: {
                'User-Agent': (new UserAgent()).toString()
              },
              url, qs, form, method, json: match ? false : json
            }, (err, res, body) => {
              if (err) {
                ponk.sendMessage(err.message)
                console.error(err)
                return
              }
              console.log(res.request.headers['User-Agent'])
              if (res.statusCode != 200) {
                if (customerr.includes(res.statusCode)) return resolve(res.statusCode)
                ponk.sendMessage('Status: ' + res.statusCode)
                console.error(body)
                return
              }
              if (match) {
                const regmatch = body.match(match)
                if (regmatch) return resolve(regmatch)
                //console.error(body)
                ponk.sendMessage('Keine Ergebnisse /elo')
                return
              }
              if (getprop) {
                if (!body[getprop]) return ponk.sendMessage('Keine Ergebnisse /elo')
                body = body[getprop]
              }
              if (getlist) {
                if (!body[getlist] || body[getlist].length < 1) return ponk.sendMessage('Keine Ergebnisse /elo')
                body = body[getlist]
                if (getrandom) body = body[Math.floor(Math.random() * body.length)]
              }
              resolve(body)
            })
          })
        },
        addNetzm: function(id, willkür, user, type = 'fi', title, url) {
          let pos = 'end'
          if (ponk.getUserRank(user) < 3 ) {
            if (ponk.chanopts.playlist_max_per_user && ponk.playlist.filter(item => item.queueby == user).length > ponk.chanopts.playlist_max_per_user) {
              return ponk.sendMessage('Addierlimit erreicht')
            }
          }
          else if (willkür) pos = 'next'
          ponk.mediaSend({ type, id, pos, title })
        }
      })
      ponk.logger.log('Registering fetch-handlers');
      resolve();
    })
  },
  handlers: {
    giphy: function(user, params, meta) {
      this.fetch('https://api.giphy.com/v1/gifs/search', {
        qs: {
          api_key: this.API.keys.giphy,
          q: params,
          limit: 5
        }, json: true,
        getlist: 'data',
        getrandom: true
      }).then(body => this.addLastImage(body.images.fixed_height.url).then(image => {
        this.sendMessage(image + '.pic')
      }))
    },
    tenor: function(user, params, meta) {
      this.fetch('https://api.tenor.com/v1/search', {
        qs: {
          api_key: this.API.keys.tenor,
          tag: params,
          limit: 5
        }, json: true,
        getlist: 'results',
        getrandom: true
      }).then(body => this.addLastImage(body.media[0].gif.url).then(image => {
        this.sendMessage(image + '.pic')
      }))
    },
    w0bm: function(user, params, meta) {
      const getW0bm = (page = '') => {
        this.fetch('https://w0bm.com/index', {
          qs: {
            q: params,
            page
          }, json: false
        }).then(body => {
          const getMatches = (string, regex, index = 1) => {
            let matches = []
            let match
            while (match = regex.exec(string)) {
              matches.push(match[index])
            }
            return matches
          }
          if (!page) {
            const pages = getMatches(body, /&amp;page=(\d+)"/g)
            if (pages.length > 0) {
              const page = Math.ceil(Math.random() * Math.max(...pages))
              if (page > 1) return getW0bm(page)
            }
          }
          const vids = getMatches(body, /<tr data-thumb="(\d+)"/g)
          if (!vids || vids.length < 1) return this.sendMessage('Keine Ergebnisse /elo')
          w0bm = vids[Math.floor(Math.random() * vids.length)]
          this.sendByFilter(imageHtml('https://w0bm.com/thumbs/' + w0bm + '.gif', 'https://b.w0bm.com/' + w0bm + '.webm'), true)
        })
      }
      if (params.length > 0) return getW0bm()
      if (!w0bm) return [...Array(meta.repeat)].forEach((c, i) => this.fetch('https://w0bm.com/api/video/random', {
        json: true
      }).then(body => {
        this.addNetzm('https://b.w0bm.com/' + body.file, meta.addnext, user)
        if (meta.repeat === 1) this.sendMessage('Zufälliges netzm von w0bm.com addiert')
        else if (meta.repeat === i + 1) this.sendMessage(meta.repeat + ' zufällige netzms von w0bm.com addiert')
      }))
      this.addNetzm('https://b.w0bm.com/' + w0bm + '.webm', meta.addnext, user)
      this.sendMessage('Letztes gif als netzm addiert')
      w0bm = false
    },
    pr0: function(user, params, meta) {
      let video = false
      params = params.replace(/(?:^| )video(?: |$)/, () => ((video = true) && '')).trim()
      if (params.length < 1 && pr0) {
        this.addNetzm('https://img.pr0gramm.com/' + pr0, meta.addnext, user)
        this.sendMessage('Letzter Daumennagel als Video addiert')
        pr0 = false
      }
      else this.fetch('https://pr0gramm.com/api/items/get', {
        qs: {
          tags: '!' + (!video ? '-' : '') + 'video ' + params,
        }, json: true,
        getlist: 'items'
      }).then(body => {
        let item = body[Math.floor(Math.random() * body.length)]
        if (!video) return this.addLastImage('https://img.pr0gramm.com/' + item.image).then(image => {
          this.sendMessage(image + '.pic')
        })
        if (params.length < 1) return [...Array(meta.repeat)].forEach((c, i) => {
          item = body[Math.floor(Math.random() * body.length)]
          this.addNetzm('https://img.pr0gramm.com/' + item.image, meta.addnext, user)
          if (meta.repeat === 1) this.sendMessage('Zufälliges Video von pr0gramm.com addiert')
          else if (meta.repeat === i + 1) this.sendMessage(meta.repeat + ' zufällige Videos von pr0gramm.com addiert')
        })
        pr0 = item.image
        this.sendByFilter(imageHtml('https://thumb.pr0gramm.com/' + item.thumb, 'https://img.pr0gramm.com/' + item.image), true)
      })
    },
    netzm: function(user, params, meta) {
      const netzms = []
      const getNetzm = (faeden, initial) => {
        if (faeden.length < 1) return this.sendMessage('Kein Faden ladiert')
        let count = faeden.length
        faeden.forEach(faden => this.fetch(faden.replace('.html', '.json'), {
          json: true,
          customerr: [404]
        }).then(body => {
          if (body === 404) return this.db.knex('netzms').where({ faden }).del().then(() => {
            this.sendMessage('Faden ' + faden + ' 404ed')
            addNetzm()
          })
          const files = (body.files || []).concat(...(body.posts || []).map(post => post.files)).filter(file => [
            'video/mp4',
            'video/webm',
            'video/ogg',
            'audio/aac',
            'audio/ogg',
            'audio/mpeg'
          ].includes(file.mime)).map(file => ({ faden, item: file.path}))
          //body.match(/(\/\w+\/\.media\/[\w-\.]+\.(mp4|flv|webm|og[gv]|mp3|mov|m4a)\/[\w- ]+\.(mp4|flv|webm|og[gv]|mp3|mov|m4a))/g)
          if (!files.length) return this.db.knex('netzms').where({faden}).del().then(() => {
            this.sendMessage('Keine netzms in ' + faden + ' gefunden')
          })
          const addNetzm = (files = []) => {
            netzms.push(...files)
            count--
            if (count > 0) return
            let added = {};
            [...Array(meta.repeat)].forEach((c, i) => {
              const netzm = netzms[Math.floor(Math.random() * netzms.length)]
              this.addNetzm('https://kohlchan.net' + netzm.item, meta.addnext, user)
              if (!added[netzm.faden]) added[netzm.faden] = 1
              else added[netzm.faden]++
            })
            Object.keys(added).forEach(faden => {
              const count = added[faden]
              if (count > 1) this.sendMessage(count + ' zufällige netzms aus ' + faden + ' addiert')
              else this.sendMessage('Zufälliges netzm aus ' + faden + ' addiert')
            })
          }
          if (initial) return this.db.knex('netzms').insert({ faden }).then(() => {
            this.sendMessage(faden + ' ' + files.length + ' netzms ladiert')
            addNetzm(files)
          })
          addNetzm(files)
        }))
      }
      this.db.knex('netzms').select('faden').then(result => {
        const faden = (params.match(/^(https:\/\/(?:www.)?kohlchan\.net\/\w+\/res\/\d+\.html)/i) || [])[1]
        getNetzm(faden ? [faden] : result.map(row => row.faden), !result.includes(faden))
      })
    },
    lauer: function(user, params, meta) {
      const siteurl = 'https://kohlchan.net'
      const url = params.match(/^https:\/\/(?:www.)?kohlchan\.net\/(\w+)\/res\/(\d+)\.html(?:#q?(\d+))?/i)
      if (!url) return this.sendMessage('Lauere nur auf KC!')
      const board = url[1]
      const thread = url[2]
      const postid = url[3] || thread
      this.fetch(siteurl + '/' + board + '/res/' + thread + '.json', {
        json: true
      }).then(body => {
        const post = (body.threadId == postid) ? body : body.posts.find(posts => posts.postId == postid)
        if (!post) return this.sendMessage('Pfosten nicht gefunden')
        if (post.subject && !/ pics$/.test(params)) this.sendByFilter('<span class="lauersubject">' + post.subject + '<span>', true)
        if (post.files.length > 0) {
          let fileshtml = ''
          post.files.forEach(file => {
            const filehtml = imageHtml(siteurl + ((file.mime != 'image/gif' && file.thumb != '/spoiler.png') ? file.thumb : file.path), siteurl + file.path)
            if ((fileshtml + filehtml).length < 1000) fileshtml += filehtml
          })
          this.sendByFilter(fileshtml, true)
        }
        if (post.markdown && !/ pics$/.test(params)) {
          const text = post.markdown.replace(/((?:href)|(?:src))="\//g, '$1="' + siteurl + '/').replace(/class="greenText"/g, 'class="greentext"')
          this.sendByFilter((post.flag ? imageHtml(siteurl + post.flag) : '') + text, true)
        }
      })
    },
    wiki: function(user, params, meta) {
      this.fetch('https://de.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(params), {
        json: true,
        customerr: [404]
      }).then(body => {
        if (body === 404) return this.sendMessage('Keine Ergebnisse /elo')
        this.sendMessage(body.content_urls.desktop.page)
        this.sendByFilter('<div class="wikiinfo">' + (body.thumbnail ? `<img class="fikuimage" src="${body.thumbnail.source}" />` : '') + body.extract_html + '</div>', true)
      })
    },
    pic: function(user, params, meta) {
      const url = validUrl.isHttpsUri(params.split(' ').shift())
      if (!url) return this.sendMessage('Ist keine https-Elfe /pfräh')
      if (/https:\/\/(?:www\.)?instagram\.com\/p\/[\w-]+\/?/i.test(url)) this.fetch(url + '?__a=1', {
        json: true
      }).then(body => {
        const image = body.graphql && body.graphql.shortcode_media && body.graphql.shortcode_media.display_url
        if (image) this.addLastImage(image).then(image => {
          this.sendMessage(image + '.pic')
        })
      })
    },
    anagramde: function(user, params, meta) {
      const text = params.toLowerCase().trim()
      if (text.length > 17) this.sendMessage('Nur 17 Zeichen /elo')
      this.fetch('http://www.sibiller.de/anagramme/cgi-bin/CallWP.cgi', {
        method: 'post',
        form: {
          text,
          anz: 5,
          max: 12,
          min: 2,
          typ: 1
        }, json: false
      }).then(body => {
        let regMatch = body.match(/     1\.  ([^\n]+)/i)
        if (!regMatch) return this.sendMessage('Keine Ergebnisse /elo')
        let anagram = regMatch[1].toLowerCase()
        if (anagram === text) {
          regMatch = body.match(/     2\.  ([^\n]+)/i)
          if (!regMatch) return this.sendMessage('Keine Ergebnisse /elo')
          anagram = regMatch[1].toLowerCase()
        }
        this.sendMessage(anagram.charAt(0).toUpperCase() + anagram.slice(1))
      })
    },
    waskochen: function(user, params, meta) {
      params = params.replace(/;/g, ',').split(',').map(param => param.trim()).join(',')
      .replace(/ö/g, 'o')
      .replace(/ä/g, 'a')
      .replace(/ü/g, 'u')
      .replace(/ß/g, 'ss')
      this.fetch('https://serve.restegourmet.de/search/', {
        method: 'post',
        json: {
          request_doc: {
            rg_wp_url: '/rezeptsuche/_/' + params + '/_/'
          }
        },
        getprop: 'recipes',
        getlist: 'items',
        getrandom: true
      }).then(body => {
        body = body._source
        this.sendMessage(body.url)
        this.sendByFilter('<div class="wikiinfo">' + ((body.images && body.images[0].url_external) ? `<img class="fikuimage" src="${body.images[0].url_external}" />` : '') +
        'Zutaten: ' + body.ingredients.map(row => row.name).join(', ') + '<br><br>' + 'Tags: ' + body.tags_channelized.join(', ')  + '</div>', true)
      })
    },
    wetter: function(user, params, meta) {
      let day = -1
      let min
      params = params.replace(/ (heute)|(morgen)|(übermorgen)$/, function() {
        day = Array.from(arguments).slice(1).findIndex(arg => !!arg)
        return ''
      }).trim()
      this.fetch('http://api.openweathermap.org/data/2.5/' + (day > -1 ? 'forecast' : 'weather'), {
        qs: {
          APPID: this.API.keys.openweather,
          q: params,
          lang: 'de',
          units: 'metric'
        }, json: true
      }).then(body => {
        if (day > -1) {
          let rows = []
          let curr = 0
          body.list.forEach((row, i) => {
            if (Number.isInteger(row.dt / 60 / 60 / 24) && i > 0) curr++
            if (curr === day) rows.push(row)
          })
          console.log(rows)
          body = rows.find(row => row.main.temp === Math.max(...rows.map(row => row.main.temp)))
          min = rows.find(row => row.main.temp === Math.min(...rows.map(row => row.main.temp)))
        }
        this.sendByFilter(imageHtml('https://openweathermap.org/img/w/' + body.weather[0].icon + '.png') + ' ' + body.weather[0].description + ' ' + body.main.temp + '°C', true)
        if (min) this.sendByFilter(imageHtml('https://openweathermap.org/img/w/' + min.weather[0].icon + '.png') + ' ' + min.weather[0].description + ' ' + min.main.temp + '°C', true)
      })
    },
    kinox: function(user, params, meta) {
      this.fetch('https://kinox.su/', {
        method: (params.length > 0) ? 'post' : 'get',
        qs: (params.length > 0) ? {
          do: 'search',
          subaction: 'search',
          story: params
        } : {},
        json: false,
        match: (params.length > 0) ? /<span class="plovkaz"><a href="([^"]+)">([^<]+)/ :
        /<div class="carousel_box"><a href="([^"]+)" class="thumbnail"  title="([^"]+)"/
      }).then(match => {
        this.fetch(match[1], {
          json: false,
          match: /<title>(.*) deutsch stream online anschauen KinoX[\s\S]+<iframe src="([^"]+)"/
        }).then(match => {
          this.sendMessage(match[1] + '; ' + match[2])
          this.commands.handlers.fikuinfo.call(this, user, match[1], meta)
        })
      })
    }
  }
}
