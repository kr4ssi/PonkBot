/*!
**|   PonkBot FIKU-System
**@
*/

'use strict';

const request = require('request')
const validUrl = require('valid-url')
const date = require('date-and-time')
const countries = require("i18n-iso-countries")

const fikulist = []

function getFikuList() {
  return new Promise(resolve => {
    if (fikulist.length) return resolve(true)
    this.db.knex('fiku').select('*').then(result => {
      result.forEach(fiku => fikulist.push(fiku))
      resolve(false)
    }, error => {
      this.logger.error('Unexpected error', '\n', error);
    })
  })
}
function getFiku(id) {
  return new Promise(resolve => {
    if (!/^\d+$/.test(id)) return this.sendMessage('Muss 1 nr sein')
    getFikuList.call(this).then(() => {
      const fiku = fikulist.find(fiku => fiku.id == id)
      if (!fiku) return this.sendMessage('ID "' + id + '" gibts nicht')
      resolve(fiku)
    })
  })
}
function getTmdbId(title) {
  return new Promise(resolve => {
    const year = title.match(/\(((?:19|20)\d{2})\)( |$)/)
    title = encodeURIComponent(title.replace(/\([^)]+\)/ig, ''))
    request({
      url: 'https://api.themoviedb.org/3/search/movie?api_key=' + this.API.keys.tmdb +
      '&query=' + (year ? title + '&year=' + year[1] : title) + '&language=de',
      json: true
    }, (err, res, body) => {
      console.log(res.request.uri.href)
      if (err || res.statusCode != 200) return console.error(err || body)
      if (!body.results || body.results.length < 1) return this.sendMessage('Keine Ergebnisse /elo')
      body = body.results.shift()
      resolve(body.id)
    })
  })
}
function getTmdbInfo(id, info, lang) {
  return new Promise(resolve => {
    request({
      url: 'https://api.themoviedb.org/3/movie/' + id + (info ? '/' + info : '') + '?api_key=' + this.API.keys.tmdb + '&language=' + lang,
      json: true
    }, (err, res, body) => {
      console.log(res.request.uri.href)
      if (err || res.statusCode != 200) return console.error(err || body)
      resolve(body)
    })
  })
}
module.exports = {
  handlers: {
    fikupoll: function(user, params, meta) {
      if (meta.rank < 3 ) return this.sendMessage('Geht nur ab lvl3')
      getFikuList.call(this).then(fikulist => {
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
        const date = new Date()
        const hour = date.getHours()
        console.log(hour)
        const opts = fikulist.map(row => row.title + ' (ID: ' + row.id + ')').concat(['Partei'])//(hour > 0 && hour < 20) ? ['Partei'] : [])
        const fikuPoll = (title, opts, timeout) => this.pollAction({
          title,
          timeout,
          opts,
          obscured: false
        }, pollvotes => {
          const max = Math.max(...pollvotes)
          if (max < 1 && title === 'Stichwahl') return this.sendMessage('Niemand hat abgestimmt. Partei!')
          const winner = opts.filter((opt, i) => pollvotes[i] === max)
          if (winner.length > 1) return fikuPoll('Stichwahl', winner, runoff)
          if (winner[0] === 'Partei') return this.sendMessage('Partei!')
          getFiku.call(this, winner[0].match(/ \(ID: (\d+)\)/)[1]).then(fikulist => {
            this.sendMessage(fikulist.title + ' wird addiert')
            this.add(user, fikulist.url + ' ' + fikulist.title + ' (ID: ' + fikulist.id + ')' + 'willkür', true)
          })
        })
        fikuPoll(title, opts, timeout)
      })
    },
    vorschlag: function(user, params, meta) {
      if (meta.rank < 2 ) return this.sendMessage('Geht nur ab lvl2')
      const split = params.trim().split(';')
      const url = validUrl.isHttpsUri(split.pop().trim())
      if (!url) return this.sendMessage('Ist keine Elfe /pfräh')
      const title = split.join().trim()
      if (!/\w/.test(title)) return this.sendMessage('Kein Titel /lobodoblörek')
      this.db.knex('fiku').insert({ title, url, user }).returning('id').then(result => {
        if (result.length > 0) {
          const id = result.pop()
          getFikuList.call(this).then(push => {
            this.sendMessage('ID: ' + id + ' "' + title + '" zur fiku-liste addiert')
            if (push) fikulist.push({ title, url, id, user })
          })
        }
      })
    },
    fikuliste: function(user, params, meta) {
      getFikuList.call(this).then(() => {
        this.sendByFilter(fikulist.map(row => row.title + ' (ID: ' + row.id + ')').join('\n'))
      })
    },
    fikulöschen: function(user, params, meta) {
      if (meta.rank < 3 ) return this.sendMessage('Geht nur ab lvl3')
      getFiku.call(this, params).then(fiku => {
        this.db.knex('fiku').where(fiku).del().then(deleted => {
          if (deleted) {
            fikulist.splice(fikulist.indexOf(fiku), 1);
            this.sendMessage('Fiku-vorschlag: "' + fiku.title + '" gelöscht')
          }
        })
      })
    },
    fikuadd: function(user, params, meta) {
      getFiku.call(this, params).then(fiku => {
        this.add(user, fiku.url + ' ' + fiku.title + ' (ID: ' + fiku.id + ')' + 'willkür', true)
      })
    },
    fikuelfe: function(user, params, meta) {
      getFiku.call(this, params).then(fiku => {
        this.sendMessage('Elfe für "' + fiku.title + '": ' + fiku.url)
      })
    },
    fikuinfo: function(user, params, meta) {
      const getInfo = title => {
        getTmdbId.call(this, title).then(id => {
          getTmdbInfo.call(this, id, 'credits', 'de').then(body => {
            const cast = body.cast.filter(row => row.order < 3).map(row => row.name).join(', ')
            getTmdbInfo.call(this, id, '', 'de').then(body => {
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
      getFiku.call(this, params).then(fiku => {
        getInfo(fiku.title)
      })
    },
    trailer: function(user, params, meta) {
      getFiku.call(this, params).then(fiku => {
        getTmdbId.call(this, fiku.title).then(id => {
          const addTrailer = lang => {
            getTmdbInfo.call(this, id, 'videos', lang).then(body => {
              if (body.results.length < 1) return (lang ? addTrailer('') : this.sendMessage('Keine Ergebnisse /elo'))
              const trailer = body.results.reduce((first, second) => second.size > first.size ? second : first)
              console.log(trailer)
              if (trailer.site == 'YouTube') this.addNetzm(trailer.key, true, user, 'yt')
            })
          }
          addTrailer('de')
        })
      })
    }
  }
}
