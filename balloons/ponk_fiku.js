/*!
**|   PonkBot FIKU-System
**@
*/

'use strict';

const parseLink = require('./parselink.js')

const validUrl = require('valid-url')
const date = require('date-and-time')
const countries = require("i18n-iso-countries")
const forwarded = require('forwarded');

const URL = require('url')
const path = require('path')
const crypto = require('crypto');
const { execFile } = require('child_process')

const needUserScript = [
  'openload.co',
  'streamango.com',
  'rapidvideo.com',
  'verystream.com'
]
const needManifest = [
  'twitter.com',
  'daserste.de',
  'zdf.de',
  'wdr.de',
  'mdr.de',
  'br.de',
  'bild.de',
  'watchbox.de',
  ...needUserScript
]
const allowedHosts = [
  'liveleak.com',
  'imgur.com',
  'instagram.com',
  'ndr.de',
  'arte.tv',
  'bandcamp.com',
  'mixcloud.com',
  'archive.org',
  'ccc.de',
  'bitchute.com',
  ...needManifest
].map(host => ({
  regex: new RegExp('^https?:\\/\\/([-\\w]+\\.)*' + ({
    'openload.co': 'openload\\.(?:co|io|link|pw)|oload\\.(?:tv|stream|site|xyz|win|download|cloud|cc|icu|fun|club|info|press|pw|live|space|services)|oladblock\\.(?:services|xyz|me)|openloed\\.co'
  }[host] || host.replace('.', '\\.')) + '\\/.+', 'i'),
  needManifest: needManifest.includes(host),
  needUserScript: needUserScript.includes(host),
  host
}))

class FikuSystem {
  constructor(ponk){
    Object.assign(this, {
      fikuList    : [],    // A list of Fiku-suggestions
      //userMedia   : [],    // A list of added media
      cmManifests : {},    // Custom-json-manifests
      userLinks   : {},    // Userlinks for IP-Bound hosters
      bot         : ponk   // The bot
    })
    const md5ip = req => crypto.createHash('md5').update(forwarded(req).pop()).digest('hex');

    const userscript = require('fs').readFileSync('ks.user.js', {encoding: "utf-8"}).replace('##WEBLINK##', this.bot.server.weblink);

    const parseDate = userscriptts => date.format(new Date(parseInt(userscriptts)), 'DD.MM.YY');

    if (/localhost/.test(this.bot.server.weblink)) this.userscriptdate = parseDate(this.bot.started);
    else this.bot.db.getKeyValue('userscripthash').then(userscripthash => {
      const newuserscripthash = crypto.createHash('md5').update(userscript).digest('hex');
      if (userscripthash === newuserscripthash) return this.bot.db.getKeyValue('userscriptts').then(userscriptts => {
        this.userscriptdate = parseDate(userscriptts)
      });
      this.userscriptdate = parseDate(this.bot.started);
      this.bot.db.setKeyValue('userscriptts', this.bot.started);
      this.bot.db.setKeyValue('userscripthash', newuserscripthash);
    });

    const fixurl = url => {
      if (typeof url === 'undefined') return false;
      url = decodeURIComponent(url).replace(/^http:\/\//i, 'https://');
      url = validUrl.isHttpsUri(url);
      if (!url) return false;
      url = url.replace(/https:\/\/(openload.co|oload\.[a-z0-9-]{2,})\/(f|embed)\//, 'https://openload.co/f/');
      return url.replace(/https:\/\/(streamango\.com|fruithosts\.net)\/(f|embed)\//, 'https://streamango.com/f/');
    }

    const userlink = (req, res) => {
      const url = fixurl(req.query.url);
      if (!url) return res.send('invalid url');
      if (!req.query.userlink) return res.send('invalid userlink');
      if (!this.userLinks[url]) this.userLinks[url] = {};
      this.userLinks[url][md5ip(req)] = req.query.userlink;
      res.send('added');
    }

    this.bot.server.host.get('/userlink', userlink);

    this.bot.server.host.get('/add.json', (req, res) => {
      if (req.query.userlink) return userlink(req, res);
      const url = fixurl(req.query.url)
      if (!url) return res.send('invalid url');
      const cmManifest = this.cmManifests[url];
      if (!cmManifest) return res.sendStatus(404);
      res.json(cmManifest.manifest);
    });

    this.bot.server.host.get('/redir', (req, res) => {
      const empty = 'https://ia801501.us.archive.org/0/items/youtube-yUUjeindT5U/VHS_simple_static_noise_-_Motion_background_loop_1-yUUjeindT5U.mp4';
      const url = fixurl(req.query.url);
      if (!url) return res.redirect(empty);
      const userLinks = this.userLinks[url];
      if (userLinks && userLinks[md5ip(req)]) res.redirect(userLinks[md5ip(req)]);
      else res.redirect(empty);
    });

    this.bot.server.host.get('/ks.user.js', (req, res) => {
      res.end(userscript);
    })

    this.bot.server.host.get('/ks.dontask.user.js', (req, res) => {
      res.end(userscript.replace('if (confirm', '//$&'));
    })

    this.bot.client.on('queueFail', data => {
      console.log(data)
      this.bot.sendMessage(data.msg.replace(/&#39;/g,  `'`) + ' ' + data.link)
    });
  }

  add (url, title, { user, willkür, fiku }) {
    let host = {}
    const manifest = {
      title,
      live: false,
      duration: 0,
      sources: [
        {
          url,
          quality: 720,
          contentType: 'application/x-mpegURL'
        }
      ]
    }
    const sendJson = (manifest, cache) => {
      if (!cache) this.cmManifests[url.replace(/https:\/\/(openload.co|oload\.[a-z0-9-]{2,})\/(f|embed)\//, 'https://openload.co/f/').replace(/https:\/\/(streamango\.com|fruithosts\.net)\/(f|embed)\//, 'https://streamango.com/f/')] = {
        manifest,
        //timestamp,
        user: {}
      }
      if (host.needUserScript) {
        manifest.sources[0].url = this.bot.server.weblink + '/redir?url=' + url
        this.bot.client.createPoll({
          title: manifest.title,
          opts: [
            'Geht nur mit Userscript',
            this.bot.server.weblink + '/ks.user.js (update vom ' + this.userscriptdate + ')',
            'dann ' + url + ' öffnen',
            'Ok klicken und falls es schon läuft player neu laden'
          ],
          obscured: false
        })
      }
      this.bot.addNetzm(this.bot.server.weblink + '/add.json?url=' + url, willkür, user, 'cm', manifest.title)
    }
    const getDuration = (manifest, info = {}) => {
      return new Promise((resolve, reject) => {
        if (manifest.live || manifest.duration) return resolve(manifest)
        let tries = 0
        const tryToGetDuration = err => {
          if (err) {
            console.error(err)
            if (tries > 1) {
              return this.bot.sendMessage('Can\'t get duration')
            }
          }
          tries++
          let params = ['-v', 'error', '-show_format', '-show_streams', '-icy', '0', '-print_format', 'json']
          if (info.http_headers) {
            const headers = Object.entries(info.http_headers).map(([key, value]) => key + ': ' + value).join('\r\n')
            console.log(headers)
            params = [...params, '-headers', headers]
          }
          execFile('ffprobe', [...params, manifest.sources[0].url], (err, stdout, stderr) => {
            if (err) return tryToGetDuration(err)
            console.log(stderr)
            let info
            try {
              info = JSON.parse(stdout)
            }
            catch(err) {
              return console.error(err)
            }
            console.log(info.format)
            if (info.format && info.format.duration) resolve(Object.assign(manifest, { duration: parseFloat(info.format.duration) }))
            else tryToGetDuration(info)
          })
        }
        tryToGetDuration()
      })
    }
    const nxLoad = () => {
      this.bot.fetch(url.replace(/embed-/i, ''), {
        json: false
      }).then(body => {
        const regMatch = body.match(/master\.m3u8","([^"]+)"(?:,"([^"]+)")?/i)
        if (!regMatch) {
          this.bot.sendMessage('Fehler')
          return console.error(body)
        }
        const titleMatch = body.match(/<title>Watch ([^<]+)/i)
        if (!title && titleMatch) title = titleMatch[1]
        if (!regMatch[2]) return this.bot.addNetzm(regMatch[1].replace(/^http:\/\//i, 'https://'), willkür, user, 'fi', title)
        manifest.title = title
        manifest.sources[0].url = regMatch[2].replace(/^http:\/\//i, 'https://')
        manifest.sources[0].contentType = 'video/mp4'
        manifest.sources[1] = {}
        manifest.sources[1].url = regMatch[1].replace(/^http:\/\//i, 'https://')
        manifest.sources[1].contentType = 'video/mp4'
        manifest.sources[1].quality = 1080
        getDuration(manifest).then(sendJson)
      })
    }
    if (url.match(/https?:\/\/(?:www\.)?nxload\.com\/(?:embed-)?(\w+)/i)) return nxLoad()
    if (/.*\.m3u8$/.test(url)) return getDuration(manifest).then(sendJson)
    host = allowedHosts.find(host => host.regex.test(url))
    if (host) return execFile('youtube-dl', ['--dump-json', '-f', 'best', '--restrict-filenames', url], {
      maxBuffer: 10485760
    }, (err, stdout, stderr) => {
      if (err) {
        this.bot.sendMessage(err.message && err.message.split('\n').filter(line => /^ERROR: /.test(line)).join('\n'))
        return console.error(err)
      }
      let data = stdout.trim().split(/\r?\n/)
      let info
      try {
        info = data.map((rawData) => JSON.parse(rawData))
      }
      catch(err) {
        return console.error(err)
      }
      if (!info.title) info = info[0];
      console.log(info)
      title = title || ((new RegExp('^' + info.extractor_key, 'i')).test(info.title) ? info.title : (info.extractor_key + ' - ' + info.title))
      if (!host.needManifest) return this.bot.addNetzm(info.url.replace(/^http:\/\//i, 'https://'), willkür, user, 'fi', title, url)
      manifest.title = title
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
      if (host.host === 'rapidvideo.com') {
        manifest.title = manifest.title.replace(/^Generic/, 'Rapidvideo')
        url = url.replace(/rapidvideo\.com\/e\//, 'rapidvideo.com/v/')
      }
      if ([240, 360, 480, 540, 720, 1080, 1440].includes(info.width)) manifest.sources[0].quality = info.width;
      if (info.thumbnail && info.thumbnail.match(/^https?:\/\//i)) manifest.thumbnail = info.thumbnail.replace(/^http:\/\//i, 'https://')
      manifest.sources[0].url = manifest.sources[0].url.replace(/^http:\/\//i, 'https://')
      manifest.duration = info.duration
      getDuration(manifest, info).then(sendJson)
    })
    if (!fiku) return this.bot.sendByFilter('Kann ' + url + ' nicht addieren. Addierbare Hosts: ' + this.bot.allowedHosts())
    const media = parseLink(url)
    if (media.type) return this.bot.mediaSend({ type: media.type, id: media.id, pos: 'next', title })
    if (media.msg) this.bot.sendMessage(media.msg)
  }
  allowedHosts() {
    return allowedHosts.map(host => host.host).join(', ')
  }
  getFikuList() {
    return new Promise(resolve => {
      if (this.fikuList.length) return resolve(true)
      this.bot.db.knex('fiku').select('*').then(result => {
        result.forEach(fiku => this.fikuList.push(fiku))
        resolve(false)
      }, error => {
        this.bot.logger.error('Unexpected error', '\n', error);
      })
    })
  }
  getFiku(id) {
    return new Promise(resolve => {
      if (!/^\d+$/.test(id)) return this.bot.sendMessage('Muss 1 nr sein')
      this.getFikuList().then(() => {
        const fiku = this.fikuList.find(fiku => fiku.id == id)
        if (!fiku) return this.bot.sendMessage('ID "' + id + '" gibts nicht')
        resolve(fiku)
      })
    })
  }
  getTmdbId(title) {
    return new Promise(resolve => {
      const year = title.match(/\(((?:19|20)\d{2})\)( |$)/)
      this.bot.fetch('https://api.themoviedb.org/3/search/movie', {
        qs: {
          api_key: this.bot.API.keys.tmdb,
          query: title.replace(/\([^)]+\)/ig, ''),
          year: year ? year[1] : '',
          language: 'de'
        },
        json: true,
        getlist: 'results'
      }).then(body => {
        resolve(body.shift().id)
      })
    })
  }
  getTmdbInfo(id, info, language) {
    return new Promise(resolve => {
      this.bot.fetch('https://api.themoviedb.org/3/movie/' + id + (info ? '/' + info : ''), {
        qs: {
          api_key: this.bot.API.keys.tmdb,
          language,
        }, json: true
      }).then(body => {
        resolve(body)
      })
    })
  }
}
module.exports = {
  meta: {
    active: true,
    type: 'giggle'
  },
  giggle: function(ponk){
    return new Promise((resolve, reject)=>{
      ponk.API.fiku = new FikuSystem(ponk);
      ponk.logger.log('Registering Fiku-System');
      resolve();
    })
  },
  handlers: {
    fikupoll: function(user, params, meta) {
      this.API.fiku.getFikuList().then(() => {
        const split = params.split(' ')
        let timeout = 0
        let runoff = 0
        if (/^[1-9][0-9]?(\.[0-9]{1-3})?$/.test(split[0])) {
          timeout = split.shift() * 60
          runoff = timeout
        }
        if (/^[1-9][0-9]?(\.[0-9]{1-3})?$/.test(split[0])) runoff = split.shift() * 60
        let title = split.join(' ').trim()
        if (!title) title = 'Fiku'
        //const date = new Date()
        //const hour = date.getHours()
        const opts = this.API.fiku.fikuList.map(row => row.title + ' (ID: ' + row.id + ')').concat(['Partei'])//(hour > 0 && hour < 20) ? ['Partei'] : [])
        const fikuPoll = (title, opts, timeout) => {
          const settings = {
            title,
            opts,
            obscured: false
          }
          if (timeout) Object.assign(settings, { timeout })
          this.pollAction(settings, pollvotes => {
            const max = Math.max(...pollvotes)
            if (max < 1 && title === 'Stichwahl') return this.sendMessage('Niemand hat abgestimmt. Partei!')
            const winner = opts.filter((opt, i) => pollvotes[i] === max)
            if (winner.length > 1) return fikuPoll('Stichwahl', winner, runoff)
            if (winner[0] === 'Partei') return this.sendMessage('Partei!')
            this.API.fiku.getFiku(winner[0].match(/ \(ID: (\d+)\)/)[1]).then(({ url, title, id, user }) => {
              this.sendMessage(title + ' (ID: ' + id + ')' + ' wird addiert')
              this.API.fiku.add(url, title + ' (ID: ' + id + ')', { user, willkür: true, fiku: true })
            })
          })
        }
        fikuPoll(title, opts, timeout)
      })
    },
    vorschlag: function(user, params, meta) {
      const split = params.trim().split(';')
      const url = validUrl.isHttpsUri(split.pop().trim())
      if (!url) return this.sendMessage('Ist keine https-Elfe /pfräh')
      const title = split.join().trim()
      if (!/\w/.test(title)) return this.sendMessage('Kein Titel /lobodoblörek')
      this.db.knex('fiku').insert({ title, url, user }).returning('id').then(result => {
        if (result.length > 0) {
          const id = result.pop()
          this.API.fiku.getFikuList().then(push => {
            this.sendMessage('ID: ' + id + ' "' + title + '" zur fiku-liste addiert')
            if (push) this.API.fiku.fikuList.push({ title, url, id, user })
          })
        }
      })
    },
    fikuListe: function(user, params, meta) {
      this.API.fiku.getFikuList().then(() => {
        this.sendByFilter(this.API.fiku.fikuList.map(row => row.title + ' (ID: ' + row.id + ')').join('\n'))
      })
    },
    fikulöschen: function(user, params, meta) {
      this.API.fiku.getFiku(params).then(fiku => {
        this.db.knex('fiku').where(fiku).del().then(deleted => {
          if (deleted) {
            this.API.fiku.fikuList.splice(this.API.fiku.fikuList.indexOf(fiku), 1);
            this.sendMessage('Fiku-vorschlag: "' + fiku.title + '" gelöscht')
          }
        })
      })
    },
    add: function(user, params, meta) {
      const split = params.split(' ')
      let url = split.shift()
      let title = split.join(' ').trim()
      url = validUrl.isHttpsUri(url)
      if (url) this.API.fiku.add(url, title, { user, willkür: meta.addnext })
      else this.sendMessage('Ist keine https-Elfe /pfräh')
    },
    fikuadd: function(user, params, meta) {
      this.API.fiku.getFiku(params).then(({ url, title, id, user }) => {
        this.API.fiku.add(url, title + ' (ID: ' + id + ')', { user, willkür: true, fiku: true })
      })
    },
    fikuelfe: function(user, params, meta) {
      this.API.fiku.getFiku(params).then(fiku => {
        this.sendMessage('Elfe für "' + fiku.title + '": ' + fiku.url)
      })
    },
    fikuinfo: function(user, params, meta) {
      const getInfo = title => {
        this.API.fiku.getTmdbId(title).then(id => {
          this.API.fiku.getTmdbInfo(id, 'credits', 'de').then(body => {
            const cast = body.cast.filter(row => row.order < 3).map(row => row.name).join(', ')
            this.API.fiku.getTmdbInfo(id, '', 'de').then(body => {
              const rlsdate = new Date(body.release_date)
              this.sendByFilter(`<img class="fikuimage" src="https://image.tmdb.org/t/p/original${body.poster_path}" /> ${body.original_title} ` +
              `(${date.format(rlsdate, 'DD.MM.YYYY')}) ` +
              `${body.production_countries.map(country => country.iso_3166_1 === 'US' ? 'VSA' : ((country.iso_3166_1 === 'UK' | country.iso_3166_1 === 'GB') ? 'England' :
              ( country.iso_3166_1 === 'RU' ? 'Russland' : countries.getName(country.iso_3166_1, 'de')))).join(' / ')} ${body.runtime} Minuten`, true)
              this.sendByFilter('<div class="fikuinfo">' + body.overview + '</div>', true)
              this.sendByFilter(`${body.genres.map(genre => genre.name).join(' / ')} mit ${cast}. Ratierung: ${body.vote_average}/10`)
            })
          })
        })
      }
      if (!/^\d+$/.test(params)) return getInfo(params)
      this.API.fiku.getFiku(params).then(fiku => {
        getInfo(fiku.title)
      })
    },
    trailer: function(user, params, meta) {
      this.API.fiku.getFiku(params).then(fiku => {
        this.API.fiku.getTmdbId(fiku.title).then(id => {
          const addTrailer = lang => {
            this.API.fiku.getTmdbInfo(id, 'videos', lang).then(body => {
              if (body.results.length < 1) return (lang ? addTrailer('') : this.sendMessage('Keine Ergebnisse /elo'))
              const trailer = body.results.reduce((first, second) => second.size > first.size ? second : first)
              if (trailer.site == 'YouTube') this.addNetzm(trailer.key, true, user, 'yt')
            })
          }
          addTrailer('de')
        })
      })
    }
  }
}
