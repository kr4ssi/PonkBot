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
      fikupoll: false, //poll running?
      bot         : ponk   // The bot
    })
    ponk.db.createTableIfNotExists('fiku', (table) => {
      table.increments();
      table.string('title', 240)
      table.string('url', 240)
      table.string('user', 20)
      table.boolean('active').defaultTo(true)
      table.bigint('timestamp').unsigned()
    })
  }
  checkFiku(url, title) {
    return new Promise((resolve, reject) => {
      url = validUrl.isHttpsUri(url)
      if (!url) throw 'Ist keine https-Elfe /pfräh'
      if (title) return resolve(title)
      const addition = this.bot.API.add.add(url, title, { gettitle: true })
      addition.getInfo(true).then(resolve)
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
  addFiku(id, meta, newuser, newurl) {
    return this.getFiku(id).then(({ url, title, id, user }) => {
      if (newurl) {
        url = newurl
        user = newuser
      }
      this.bot.API.add.add(url, title + ' (ID: ' + id + ')', {
        user,
        addnext: true,
        fiku: true
      }).on('closetoend', () => {
        this.delFiku(id).then(() => {
          if (!this.fikupoll) this.fikuPoll(user, '', meta)
        })
      })
      return { url, title, id, user }
    })
  }
  delFiku(id) {
    return this.getFiku(id).then(fiku => {
      return this.bot.db.knex('fiku').where(fiku).del().then(deleted => {
        if (deleted) {
          this.bot.sendMessage('Fiku-vorschlag: "' + fiku.title + '" gelöscht')
        }
      })
    })
  }
  getTmdbId(title) {
    return new Promise(resolve => {
      const year = title.match(/\(((?:19|20)\d{2})\)( |$)/)
      this.bot.fetch('https://api.themoviedb.org/3/search/multi', {
        qs: {
          api_key: this.bot.API.keys.tmdb,
          query: title.replace(/\([^)]+\)/ig, ''),
          year: year ? year[1] : '',
          language: 'de'
        },
        json: true,
        getlist: 'results'
      }).then(({ list }) => {
        resolve({
          id: list[0].id,
          type: list[0].media_type
        })
      })
    })
  }
  getTmdbInfo({ id, type }, info, language) {
    return new Promise(resolve => {
      this.bot.fetch(`https://api.themoviedb.org/3/${type}/${id}${info ? '/' + info : ''}`, {
        qs: {
          api_key: this.bot.API.keys.tmdb,
          language,
        }, json: true
      }).then(({ body }) => {
        resolve(body)
      })
    })
  }
  fikuPoll(user, params, meta) {
    this.getFikuList().then(fikuList => {
      const split = params.split(' ')
      let timeout = 0
      let runoff = 0
      if (/^[1-9][0-9]?(\.[0-9]{1-3})?$/.test(split[0])) {
        timeout = split.shift() * 60
        runoff = timeout
      }
      if (/^[1-9][0-9]?(\.[0-9]{1-3})?$/.test(split[0]))
      runoff = split.shift() * 60
      let title = split.join(' ').trim()
      if (!title) title = 'Fiku'
      //const date = new Date()
      //const hour = date.getHours()
      let opts = fikuList.filter(row => row.active)
      if (meta && meta.command === 'ausschussfiku') opts.filter((row, i) => i < 8)
      opts = opts.map(row => `${row.title} (ID: ${row.id})`).concat(['Partei'])//(hour > 0 && hour < 20) ? ['Partei'] : [])
      const fikuPoll = (title, opts, timeout) => {
        this.fikupoll = true
        this.bot.pollAction({
          title,
          opts,
          obscured: false,
          timeout: timeout || undefined
        }).then(pollvotes => {
          this.fikupoll = false
          const max = Math.max(...pollvotes)
          if (max < 1 && title === 'Stichwahl')
          return setFiku('Niemand hat abgestimmt. Partei!')
          const winner = opts.filter((opt, i) => pollvotes[i] === max)
          if (winner.length > 1) return fikuPoll('Stichwahl', winner, runoff)
          if (winner[0] === 'Partei') return setFiku('Partei!')
          const id = winner[0].match(/ \(ID: (\d+)\)/)[1]
          this.addFiku(id, meta).then(({ title }) => {
            this.bot.sendMessage(`${title} (ID: ${id}) wird addiert`)
          })
        })
      }
      const setFiku = (msg) => {
        if (msg) this.bot.sendMessage(msg)
        this.bot.API.emotes.logoHintergrund(this.name, (msg ? 'last' : 'fiku'), { command: 'hintergrund' })
        setTimeout(() => this.bot.API.emotes.logoHintergrund(this.name, (msg ? 'last' : 'fiku'), { command: 'logo' }), 1000)
      }
      fikuPoll(title, opts, timeout)
      setFiku()
    })
  }
}
module.exports = {
  meta: {
    active: true,
    type: 'giggle'
  },
  giggle(ponk){
    return new Promise((resolve, reject)=>{
      ponk.API.fiku = new FikuSystem(ponk);
      ponk.logger.log('Registering Fiku-System');
      resolve();
    })
  },
  handlers: {
    fikupoll(user, params, meta) {
      this.API.fiku.fikuPoll(user, params, meta)
    },
    ausschussfiku(user, params, meta) {
      this.API.fiku.fikuPoll(user, params, meta)
    },
    vorschlag(user, params, meta) {
      if (params.includes(';')) {
        const legacy = params.trim().split(';')
        params = legacy.pop().trim() + ' ' + legacy.join(' ')
      }
      const [url, ...title] = params.trim().split(' ')
      this.API.fiku.checkFiku(url, title.join(' ')).then(title => {
        if (!/\w/.test(title)) throw 'Kein Titel /lobodoblörek'
        const fiku = { title, url, user, active: true, timestamp: Date.now() }
        this.db.knex('fiku').insert(fiku).returning('id').then(result => {
          if (!result.length) throw 'Unexpected Error'
          const id = result.pop()
          this.sendMessage('ID: ' + id + ' "' + title + '" zur fiku-liste addiert')
        })
      }, err => this.sendMessage(err))
    },
    fikuliste(user, params, meta) {
      this.API.fiku.getFikuList().then(fikuList => {
        this.sendByFilter(fikuList.map(row =>  row.id + ': ' + row.title
        + ' (' + (new Date(row.timestamp || 0)).toLocaleDateString() + ')'
        + (row.active ? '' : ' (deaktiviert)')).join('\n'))
      })
    },
    fikulöschen(user, params, meta) {
      this.API.fiku.delFiku(params)
    },
    fikuadd(user, params, meta) {
      const split = params.split(' ')
      const id = split.shift()
      let newurl = split.shift()
      if (newurl) {
        newurl = validUrl.isHttpsUri(newurl)
        if (!newurl)
        return this.sendMessage('Ist keine https-Elfe /pfräh')
      }
      this.API.fiku.addFiku(id, meta, user, newurl)
    },
    fikuelfe(user, params, meta) {
      this.API.fiku.getFiku(params).then(fiku => {
        this.sendMessage('Elfe für "' + fiku.title + '": ' + fiku.url)
      })
    },
    fikuwer(user, params, meta) {
      this.API.fiku.getFiku(params).then(fiku => {
        this.sendMessage('Vorschlag "' + fiku.title + '" ist von: ' + fiku.user)
      })
    },
    fikuaktiv(user, params, meta) {
      this.API.fiku.getFiku(params).then(fiku => {
        const active = !fiku.active
        this.db.knex('fiku').where(fiku).update({ active }).then(() => {
          this.sendMessage('Eintrag ' + fiku.title + ' ' + (active ? '' : 'de') + 'aktiviert')
        })
      })
    },
    fikuändern(user, params, meta) {
      const [id, url, ...title] = params.trim().split(' ')
      this.API.fiku.checkFiku(url, 'title').then(() => {
        this.API.fiku.getFiku(id).then(fiku => {
          if (fiku.user != user && this.getUserRank(user) < 3)
          throw 'Du kannst nur deine eigenen Vorschläge ändern'
          const update = { url }
          if (title.length) update.title = title.join(' ')
          this.db.knex('fiku').where(fiku).update(update).then(() => {
            this.sendMessage('Eintrag ' + fiku.id + ' ist jetzt: ' + url + ' ' + title.join(' '))
          })
        })
      }, err => this.sendMessage(err))
    },
    fikuinfo(user, params, meta) {
      Promise.resolve().then(() => {
        if (/^\d+$/.test(params)) return this.API.fiku.getFiku(params)
        return { title: params || this.currMedia.title }
      }).then(({ title }) => {
        this.API.fiku.getTmdbId(title).then(id => {
          this.API.fiku.getTmdbInfo(id, 'credits', 'de').then(credits => {
            this.API.fiku.getTmdbInfo(id, '', 'de').then(body => {
              const rlsdate = new Date(body.release_date || body.first_air_date)
              this.sendByFilter(`<img class="fikuimage" src="https://image.tmdb.org/t/p/original${body.poster_path}" />` +
              `${body.original_title || body.original_name} ` +
              `(${date.format(rlsdate, 'DD.MM.YYYY')}) ` +
              `${(body.production_countries || body.origin_country).map(country => {
                country = country.iso_3166_1 || country
                return {
                  US: 'VSA',
                  UK: 'England',
                  GB: 'England',
                  RU: 'Russland'
                }[country] || countries.getName(country, 'de')
              }).join(' / ')} ` +
              `${body.runtime || (body.episode_run_time && body.episode_run_time[0])} Minuten`, true)
              this.sendByFilter(`<div class="fikuinfo">${body.overview}</div>`, true)
              this.sendByFilter(`${body.genres.map(genre => genre.name).join(' / ')} mit ` +
              `${credits.cast.filter(row => row.order < 3).map(row => row.name).join(', ')}.\n` +
              `Von ${[...new Set([
                'Executive Producer',
                'Writer',
                'Screenplay',
                'Director',
                'First Assistant Director'
              ].reduce((list, job) => {
                return list.concat(credits.crew.filter(crew => crew.job === job))
              }, []).concat(credits.crew.filter(crew => {
                return crew.department === 'Production'
              })).map(item => item.name))].slice(0, 3).join(', ')}. ` +
              `Ratierung: ${body.vote_average}/10`)
            })
          })
        })
      })
    },
    trailer(user, params, meta) {
      this.API.fiku.getFiku(params).then(fiku => {
        this.API.fiku.getTmdbId(fiku.title).then((id) => {
          const addTrailer = lng => {
            this.API.fiku.getTmdbInfo(id, 'videos', lng).then(({ results }) => {
              if (!results.length) {
                if (lng) addTrailer('')
                else this.sendMessage('Keine Ergebnisse /elo')
                return
              }
              const trailer = results.reduce((a, b) => a.size > b.size ? a : b)
              if (trailer.site != 'YouTube') return
              this.addNetzm(trailer.key, true, user, 'yt')
            })
          }
          addTrailer('de')
        })
      })
    }
  }
}
