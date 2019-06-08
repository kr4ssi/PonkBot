/*!
**|   PonkBot FIKU-System
**@
*/

'use strict';

const validUrl = require('valid-url')
const date = require('date-and-time')
const countries = require("i18n-iso-countries")

class FikuSystem {
  constructor(ponk){
    Object.assign(this, {
      fikuList    : [],    // A list of Fiku-suggestions
      bot         : ponk   // The bot
    })
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
              this.API.add.add(url, title + ' (ID: ' + id + ')', { user, willkür: true, fiku: true })
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
    fikuliste: function(user, params, meta) {
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
    fikuadd: function(user, params, meta) {
      this.API.fiku.getFiku(params).then(({ url, title, id, user }) => {
        this.API.add.add(url, title + ' (ID: ' + id + ')', { user, willkür: true, fiku: true })
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
