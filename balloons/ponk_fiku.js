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
      //fikuList    : [],    // A list of Fiku-suggestions
      bot         : ponk   // The bot
    })
  }

  getFikuList() {
    return new Promise(resolve => {
      //if (this.fikuList.length) return resolve(true)
      this.bot.db.knex('fiku').select('*').then(result => {
        //result.forEach(fiku => this.fikuList.push(fiku))
        resolve(result)
      }, error => {
        this.bot.logger.error('Unexpected error', '\n', error);
      })
    })
  }
  getFiku(id) {
    return new Promise((resolve, reject) => {
      if (!/^\d+$/.test(id)) return this.bot.sendMessage('Muss 1 nr sein')
      this.bot.db.knex('fiku').where({ id }).select('*').then(rows => {
        //const fiku = this.fikuList.find(fiku => fiku.id == id)
        if (!rows.length) {
          return this.bot.sendMessage('ID "' + id + '" gibts nicht')
        }
        const row = rows.shift();
        resolve(row)
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
      }).then(({ list }) => {
        resolve(list[0].id)
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
      }).then(({ body }) => {
        resolve(body)
      })
    })
  }
  fikupoll(user, params, meta) {
    this.getFikuList().then(fikuList => {
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
      const opts = fikuList.filter((row, i, arr) => row.active && (meta.command === 'ausschussfiku' ? (i < 8) : true)).map(row => row.title + ' (ID: ' + row.id + ')').concat(['Partei'])//(hour > 0 && hour < 20) ? ['Partei'] : [])
      const fikuPoll = (title, opts, timeout) => {
        const settings = {
          title,
          opts,
          obscured: false
        }
        if (timeout) settings.timeout = timeout
        this.bot.pollAction(settings).then(pollvotes => {
          const max = Math.max(...pollvotes)
          if (max < 1 && title === 'Stichwahl') return setFiku('Niemand hat abgestimmt. Partei!')
          const winner = opts.filter((opt, i) => pollvotes[i] === max)
          if (winner.length > 1) return fikuPoll('Stichwahl', winner, runoff)
          if (winner[0] === 'Partei') return setFiku('Partei!')
          this.getFiku(winner[0].match(/ \(ID: (\d+)\)/)[1]).then(({ url, title, id, user }) => {
            this.bot.sendMessage(title + ' (ID: ' + id + ')' + ' wird addiert')
            this.bot.API.add.add(url, title + ' (ID: ' + id + ')', { user, addnext: true, fiku: true })
          })
        })
      }
      const setFiku = (msg) => {
        if (msg) this.bot.sendMessage(msg)
        this.bot.commandDispatcher(user, '.hintergrund ' + (msg ? 'last' : 'KinoX'))
        setTimeout(() => this.bot.commandDispatcher(user, '.logo ' + (msg ? 'last' : 'FIKU')), 1000)
      }
      fikuPoll(title, opts, timeout)
      console.log(meta)
      setFiku()
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
      this.API.fiku.fikupoll(user, params, meta)
    },
    ausschussfiku: function(user, params, meta) {
      this.API.fiku.fikupoll(user, params, meta)
    },
    vorschlag: async function(user, params, meta) {
      const split = params.trim().split(';')
      let url = validUrl.isHttpsUri(split.pop().trim())
      if (!url) return this.sendMessage('Ist keine https-Elfe /pfräh')
      let title = split.join().trim()
      if (!title) try {
        ({ title, location: url } = await this.API.add.allowedHosts.hostAllowed(url).then(host => {
          if (host.name != 'kinox.to') reject()
          else return host
        }).then(host => host.getInfo(url, true)))
      }
      catch (err) {
        console.error(err)
      }
      if (!/\w/.test(title)) return this.sendMessage('Kein Titel /lobodoblörek')
      const fiku = { title, url, user, active: true, timestamp: Date.now() }
      this.db.knex('fiku').insert(fiku).returning('id').then(result => {
        if (result.length > 0) {
          const id = result.pop()
          //this.API.fiku.getFikuList().then(push => {
          this.sendMessage('ID: ' + id + ' "' + title + '" zur fiku-liste addiert')
          //  if (push) this.API.fiku.fikuList.push(Object.assign(fiku, { id }))
          //})
        }
      })
    },
    fikuliste: function(user, params, meta) {
      this.API.fiku.getFikuList().then(fikuList => {
        this.sendByFilter(fikuList.map(row =>  row.id + ': ' + row.title
        + ' (' + (new Date(row.timestamp || 0)).toLocaleDateString() + ')'
        + (row.active ? '' : ' (deaktiviert)')).join('\n'))
      })
    },
    fikulöschen: function(user, params, meta) {
      this.API.fiku.getFiku(params).then(fiku => {
        this.db.knex('fiku').where(fiku).del().then(deleted => {
          if (deleted) {
            //this.API.fiku.fikuList.splice(this.API.fiku.fikuList.indexOf(fiku), 1);
            this.sendMessage('Fiku-vorschlag: "' + fiku.title + '" gelöscht')
          }
        })
      })
    },
    fikuadd: function(user, params, meta) {
      const split = params.split(' ')
      const id = split.shift()
      this.API.fiku.getFiku(id).then(({ url, title, id, user }) => {
        let newurl = split.shift()
        if (newurl) {
          url = validUrl.isHttpsUri(newurl)
          if (!url) return this.sendMessage('Ist keine https-Elfe /pfräh')
        }
        this.API.add.add(url, title + ' (ID: ' + id + ')', { user, addnext: true, fiku: true })
      })
    },
    fikuelfe: function(user, params, meta) {
      this.API.fiku.getFiku(params).then(fiku => {
        this.sendMessage('Elfe für "' + fiku.title + '": ' + fiku.url)
      })
    },
    fikuaktiv: function(user, params, meta) {
      this.API.fiku.getFiku(params).then(fiku => {
        const active = !fiku.active
        this.db.knex('fiku').where(fiku).update({ active }).then(() => {
          //this.API.fiku.fikuList.find(row => row === fiku).active = active
          this.sendMessage('Eintrag ' + fiku.title + ' ' + (active ? '' : 'de') + 'aktiviert')
        })
      })
    },
    fikuändern: async function(user, params, meta) {
      const split = params.split(' ')
      let id = split.shift()
      let url = split.shift()
      let title = split.join(' ').trim()
      url = validUrl.isHttpsUri(url)
      if (!url) return this.sendMessage('Ist keine https-Elfe /pfräh')
      try {
        ({ title, location: url } = await this.API.add.allowedHosts.hostAllowed(url).then(host => {
          if (host.name != 'kinox.to') reject()
          else return host
        }).then(host => host.getInfo(url, true)))
      }
      catch (err) {
        console.error(err)
        title = split.join(' ').trim()
      }
      this.API.fiku.getFiku(id).then(fiku => {
        if (fiku.user != user && this.getUserRank(user) < 3 ) {
          return this.sendMessage('Du kannst nur deine eigenen Vorschläge ändern')
        }
        const update = { url }
        if (title) update.title = title
        this.db.knex('fiku').where(fiku).update(update).then(() => {
          //this.API.fiku.fikuList.find(row => row === fiku).active = active
          this.sendMessage('Eintrag ' + fiku.id + ' ist jetzt: ' + url + ' ' + title)
        })
      })
    },
    fikuinfo: function(user, params, meta) {
      (/^\d+$/.test(params) ? this.API.fiku.getFiku(params).then(({ title }) => title) : Promise.resolve(params || this.currMedia.title)).then(title => {
        this.API.fiku.getTmdbId(title).then(id => {
          this.API.fiku.getTmdbInfo(id, 'credits', 'de').then(body => {
            const cast = body.cast.filter(row => row.order < 3).map(row => row.name).join(', ')
            let crew = body.crew.reduce((jobs, item) => {
              const itemstring = `${item.name}: ${item.job}`
              if (!jobs.department[item.department]) jobs.department[item.department] = []
              jobs.department[item.department].push(itemstring)
              if (!jobs.jobs[item.job]) jobs.jobs[item.job] = []
              jobs.jobs[item.job].push(itemstring)
              return jobs
            }, {
              department: {},
              jobs: {},
            })
            console.log(crew.department)
            crew = [...[...new Set([
              'Executive Producer',
              'Writer',
              'Screenplay',
              'Director',
              'First Assistant Director'
            ].reduce((list, job) => list.concat(body.crew.filter(crew => crew.job === job)), [])
            .concat(body.crew.filter(crew => crew.department === 'Production'))
            .map(item => item.name))]].slice(0, 3).join(', ')
            console.log(crew)
            //crew = ''
            this.API.fiku.getTmdbInfo(id, '', 'de').then(body => {
              const rlsdate = new Date(body.release_date)
              this.sendByFilter(`<img class="fikuimage" src="https://image.tmdb.org/t/p/original${body.poster_path}" /> ${body.original_title} ` +
              `(${date.format(rlsdate, 'DD.MM.YYYY')}) ` +
              `${body.production_countries.map(country => country.iso_3166_1 === 'US' ? 'VSA' : ((country.iso_3166_1 === 'UK' | country.iso_3166_1 === 'GB') ? 'England' :
              ( country.iso_3166_1 === 'RU' ? 'Russland' : countries.getName(country.iso_3166_1, 'de')))).join(' / ')} ${body.runtime} Minuten`, true)
              this.sendByFilter('<div class="fikuinfo">' + body.overview + '</div>', true)
              this.sendByFilter(`${body.genres.map(genre => genre.name).join(' / ')} mit ${cast}.\nVon ${crew}. Ratierung: ${body.vote_average}/10`)
            })
          })
        })
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
