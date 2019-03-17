/*!
**|   PonkBot FIKU-System
**@
*/

'use strict';

const request = require('request')
const validUrl = require('valid-url')
const date = require('date-and-time')
const countries = require("i18n-iso-countries")

let fikuliste = {}

function getFikuListe() {
  return new Promise((resolve) => {
    const mapList = () => resolve(Object.entries(fikuliste).map(row => ({url: row[1].url, title: row[1].title, id: row[0]})))
    if (Object.keys(fikuliste).length > 0) return mapList()
    this.db.knex('fiku').select('*').then(result => {
      result.forEach(fiku => fikuliste[fiku.id] = fiku)
      mapList()
    }).catch(error => {
      this.logger.error('Unexpected error', '\n', error);
    })
  })
}

function getFiku(id) {
  return new Promise((resolve, reject) => {
    if (!/^\d+$/.test(id)) return reject('Muss 1 nr sein')
    getFikuListe.call(this).then(fikuliste => {
      const fiku = fikuliste.find(fiku => fiku.id === id)
      if (!fiku) return reject('ID "' + id + '" gibts nicht')
      resolve(fiku)
    })
  })
}

module.exports = {
  handlers: {
    fikupoll: function(user, params, meta) {
      this.checkPermission({
        user, rank: 3
      }).then(() => {
        getFikuListe.call(this).then(result => {
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
          const opts = result.map(row => row.title + ' (ID: ' + row.id + ')').concat(['Partei'])//(hour > 0 && hour < 20) ? ['Partei'] : [])
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
            getFiku.call(this, winner[0].match(/ \(ID: (\d+)\)/)[1]).then(result => {
              this.sendMessage(result.title + ' wird addiert')
              this.add(user, result.url + ' ' + result.title + ' (ID: ' + result.id + ')' + 'willkür', true)
            }).catch(error => {
              this.sendMessage(error)
            })
          })
          fikuPoll(title, opts, timeout)
        })
      }).catch(message => {
        this.sendPrivate(message, user)
      })
    },
    vorschlag: function(user, params, meta) {
      this.checkPermission({
        user, rank: 2
      }).then(() => {
        const split = params.trim().split(';')
        const url = validUrl.isHttpsUri(split.pop().trim())
        if (!url) return this.sendMessage('Ist keine Elfe /pfräh')
        const title = split.join().trim()
        if (!/\w/.test(title)) return this.sendMessage('Kein Titel /lobodoblörek')
        const match = /[zs5][0o]mb[0oe3]r/i
        if (match.test(user) && match.test(url)) return this.sendMessage(`/kick ${user} /soeinfach`, { ignoremute: true })
        const send = year => {
          if (year) title += ' (' + year + ')'
          this.db.knex('fiku').insert({ title, url, user }).returning('id').then(result => {
            if (result.length > 0) {
              const id = result.pop()
              getFikuListe.call(this).then(result => {
                this.sendMessage('ID: ' + id + ' "' + title + '" zur fiku-liste addiert')
                fikuliste[id] = { title, url, id }
              })
            }
          })
        }
        send()
      }, message => {
        this.sendPrivate(message, user)
      })
    },
    fikuliste: function(user, params, meta) {
      getFikuListe.call(this).then(result => {
        this.sendByFilter(result.map(row => row.title + ' (ID: ' + row.id + ')').join('\n'))
      })
    },
    fikulöschen: function(user, params, meta) {
      this.checkPermission({
        user, rank: 3
      }).then(() => {
        getFiku.call(this, params).then(result => {
          const title = result.title
          const id = result.id
          this.db.knex('fiku').where({ id }).del().then(deleted => {
            if (deleted) {
              delete fikuliste[id]
              this.sendMessage('Fiku-vorschlag: "' + title + '" gelöscht')
            }
          })
        }).catch(error => {
          this.sendMessage(error)
        })
      }).catch(message => {
        this.sendPrivate(message, user)
      })
    },
    fikuadd: function(user, params, meta) {
      getFiku.call(this, params).then(result => {
        this.add(user, result.url + ' ' + result.title + ' (ID: ' + result.id + ')' + 'willkür', true)
      }).catch(error => {
        this.sendMessage(error)
      })
    },
    fikuelfe: function(user, params, meta) {
      getFiku.call(this, params).then(result => {
        this.sendMessage('Elfe für "' + result.title + '": ' + result.url)
      }).catch(error => {
        this.sendMessage(error)
      })
    },
    fikuinfo: function(user, params, meta) {
      getFiku.call(this, params).then(result => {
        const year = result.title.match(/\(((?:19|20)\d{2})\)( |$)/)
        function deUmlaut(value){
          value = value.toLowerCase();
          value = value.replace(/ä/g, 'ae');
          value = value.replace(/ö/g, 'oe');
          value = value.replace(/ü/g, 'ue');
          value = value.replace(/ß/g, 'ss');
          return value;
        }
        request({
          url: 'https://api.themoviedb.org/3/search/movie?api_key=' + this.API.keys.tmdb + '&query=' +
          (year ? deUmlaut(result.title.replace(year[0], '')) + '&year=' + year[1] : deUmlaut(result.title)) + '&language=de&',
          json: true
        }, (err, res, body) => {
          if (err || res.statusCode != 200) return console.error(err || body)
          if (!body.results || body.results.length < 1) return this.sendMessage('Keine Ergebnisse /elo')
          body = body.results.shift()
          const id = body.id
          request({
            url: 'https://api.themoviedb.org/3/movie/ ' + id + '/credits?api_key=' + this.API.keys.tmdb,
            json: true
          }, (err, res, body) => {
            if (err || res.statusCode != 200) return console.error(err || body)
            const cast = body.cast.filter(row => row.order < 3).map(row => row.name).join(', ')
            request({
              url: 'https://api.themoviedb.org/3/movie/ ' + id + ' ?api_key=' + this.API.keys.tmdb + '&language=de&',
              json: true
            }, (err, res, body) => {
              if (err || res.statusCode != 200) return console.error(err || body)
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
      }).catch(error => {
        this.sendMessage(error)
      })
    },
    trailer: function(user, params, meta) {
      getFiku.call(this, params).then(result => {
        const year = result.title.match(/\(?((?:19|20)\d{2})\)?( |$)/)
        request({
          url: 'https://api.themoviedb.org/3/search/movie?api_key=' + this.API.keys.tmdb + '&query=' +
          (year ? result.title.replace(year[0], '') + '&year=' + year[1] : result.title) + '&language=de&',
          json: true
        }, (err, res, body) => {
          if (err || res.statusCode != 200) return console.error(err || body)
          if (!body.results || body.results.length < 1) return this.sendMessage('Keine Ergebnisse /elo')
          body = body.results.shift()
          const id = body.id
          request({
            url: 'https://api.themoviedb.org/3/movie/' + id + '/videos?api_key=' + this.API.keys.tmdb + '&language=de',
            json: true
          }, (err, res, body) => {
            if (err || res.statusCode != 200) return console.error(err || body)
            let results = body.results
            const addTrailer = results => {
              if (results.length < 1) return this.sendMessage('Keine Ergebnisse /elo')
              const trailer = results.reduce((first, second) => second.size > first.size ? second : first)
              console.log(trailer)
              if (trailer.site == 'YouTube') this.addNetzm(trailer.key, true, user, 'yt')
            }
            if (results.length < 1) return request({
              url: 'https://api.themoviedb.org/3/movie/' + id + '/videos?api_key=' + this.API.keys.tmdb,
              json: true
            }, (err, res, body) => {
              if (err || res.statusCode != 200) return console.error(err || body)
              trailer = body.results
              addTrailer(results)
            })
            addTrailer(results)
          })
        })
      })
    }
  }
}
