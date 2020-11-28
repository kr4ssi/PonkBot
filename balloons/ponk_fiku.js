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
      fikupoll    : false, //poll running?
      bot         : ponk   // The bot
    })
    ponk.db.createTableIfNotExists('fiku', table => {
      table.increments()
      table.string('title', 240)
      table.string('url', 240)
      table.string('user', 20)
      table.boolean('active').defaultTo(true)
      table.bigint('timestamp').unsigned()
    })
    ponk.db.createTableIfNotExists('fikuseen', table => {
      table.string('title', 240)
      table.string('user', 20)
      table.bigint('timestamp').unsigned().primary()
    })
  }
  checkFiku(url, title = '') {
    return Promise.resolve(validUrl.isHttpsUri(url)).then(url => {
      if (!url) throw 'Ist keine https-Elfe /pfräh'
      if (/^tt\d+/.test(title)) return this.getTmdbInfo({
        id: title,
        media_type: 'find'
      }).then(({ movie_results }) => {
        if (!movie_results.length) throw 'Keine Imdb-Id'
        const info = movie_results.shift()
        return {
          title: `${info.original_title} (${info.release_date.slice(0, 4)})`
        }
      })
      if (title) return { title }
      return this.bot.API.add.add(url, title, { gettitle: true }).getInfo()
    }).then(({ title }) => {
      if (!/\w/.test(title)) throw 'Kein Titel /lobodoblörek'
      return title
    })
  }
  getFikuList() {
    return this.bot.db.knex('fiku').where({ played: null }).select('*')
  }
  getFiku(id) {
    return Promise.resolve().then(() => {
      if (!/^\d+$/.test(id)) throw 'Muss 1 nr sein'
      return this.bot.db.knex('fiku').where({ id }).select('*').then(result => {
        if (!result.length) throw `ID ${id} gibts nicht`
        return result.shift()
      })
    }).catch(err => {
      this.bot.sendMessage(err)
      throw err
    })
  }
  addFiku(id, meta, newuser, newurl) {
    return this.getFiku(id).then(({ url, title, id, user }) => {
      if (newurl) [url, user] = [newurl, newuser]
      return this.bot.API.add.add(url, title + ' (ID: ' + id + ')', {
        user,
        addnext: true,
        fiku: true
      })
    })
  }
  delFiku(id) {
    return this.getFiku(id).then(({ title, user }) => {
      const seen = { title, user, timestamp: Date.now() }
      return this.bot.db.knex('fikuseen').insert(seen).then(() => {
        return this.bot.db.knex('fiku').where({ id }).del().then(deleted => {
          if (deleted) {
            this.bot.sendMessage(`Fiku-vorschlag: "${title}" gelöscht`)
          }
        })
      })
    })
    //return this.bot.db.knex('fiku').where(fiku).update({ played: Date.now() })
  }
  getTmdbId(title) {
    const year = title.match(/\(((?:19|20)\d{2})\)( |$)/)
    return this.bot.fetch('https://api.themoviedb.org/3/search/multi', {
      qs: {
        api_key: this.bot.API.keys.tmdb,
        query: title.replace(/\([^)]+\)/ig, ''),
        year: year ? year[1] : '',
        language: 'de'
      },
      json: true,
      getlist: 'results'
    }).then(({ list: [{ id, media_type }] }) => ({ id, media_type }))
  }
  getTmdbInfo({ id, media_type }, info, language = 'de') {
    return this.bot.fetch(`https://api.themoviedb.org/3/${media_type}/${id}${info ? '/' + info : ''}`, {
      qs: {
        api_key: this.bot.API.keys.tmdb,
        language,
        external_source: media_type === 'find' ? 'imdb_id' : undefined
      }, json: true
    }).then(({ body }) => body)
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
      let opts = fikuList.filter(row => row.active)
      if (meta && meta.command === 'ausschussfiku') opts = opts.filter((row, i) => i < 8)
      opts = opts.map(row => `${row.title} (ID: ${row.id})`).concat(['Partei'])
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
          const [ , title, id] = winner[0].match(/(^.*) \(ID: (\d+)\)/)
          this.addFiku(id, meta).then(addition => {
            this.bot.sendMessage(`${title} wird addiert`)
            addition.on('closetoend', () => {
              this.delFiku(id).then(() => {
                if (!this.fikupoll) this.fikuPoll(user, '', meta)
              })
            }).on('queue', () => {
              const playlist = this.bot.playlist.filter(item => item.temp)
              playlist.sort((a, b) => a.media.seconds - b.media.seconds)
              let seconds = 0
              while (seconds < 600 && playlist.length) {
                const item = playlist.shift()
                seconds = seconds + item.media.seconds
                if (seconds > 720) break
                this.bot.mediaMove({ from: item.uid })
              }
            })
          })
        })
      }
      const setFiku = (msg) => {
        if (msg) this.bot.sendMessage(msg)
        this.bot.API.emotes.logoHintergrund(this.name, (msg ? 'last' : '/bgfiku'), { command: 'hintergrund' })
        setTimeout(() => this.bot.API.emotes.logoHintergrund(this.name, (msg ? 'last' : '/logofiku'), { command: 'logo' }), 2000)
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
        + ` (${(new Date(row.timestamp || 0)).toLocaleDateString()})`
        + (row.active ? '' : ' (deaktiviert)')).join('\n'))
      })
    },
    fikulöschen(user, params, meta) {
      this.API.fiku.getFiku(params).then(fiku => {
        this.db.knex('fiku').where(fiku).del().then(deleted => {
          if (deleted) {
            this.sendMessage('Fiku-vorschlag: "' + fiku.title + '" gelöscht')
          }
        })
      }).catch(console.error)
    },
    fikuadd(user, params, meta) {
      const split = params.split(' ')
      const id = split.shift()
      let newurl = split.shift()
      if (newurl) {
        newurl = validUrl.isHttpsUri(newurl)
        if (!newurl) return this.sendMessage('Ist keine https-Elfe /pfräh')
      }
      this.API.fiku.addFiku(id, meta, user, newurl).then(fiku => fiku.on('closetoend', () => {
        this.API.fiku.delFiku(id)
      }))
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
          this.sendMessage(`Eintrag ${fiku.title} ${active ? '' : 'de'}aktiviert`)
        })
      })
    },
    fikuändern(user, params, meta) {
      const [id, url, ...title] = params.trim().split(' ')
      this.API.fiku.checkFiku(url, title.join(' ')).then(title => {
        this.API.fiku.getFiku(id).then(fiku => {
          if (fiku.user != user && this.getUserRank(user) < 3)
          throw 'Du kannst nur deine eigenen Vorschläge ändern'
          this.db.knex('fiku').where(fiku).update({ url, title }).then(() => {
            this.sendMessage(`Eintrag ${fiku.id} ist jetzt: ${url} ${title}`)
          })
        })
      }, err => this.sendMessage(err))
    },
    fikuinfo(user, params, meta) {
      Promise.resolve().then(() => {
        if (/^\d+$/.test(params)) return this.API.fiku.getFiku(params)
        return { title: params || this.currMedia.title }
      }).then(({ title }) => this.API.fiku.getTmdbId(title).then(id => {
        this.API.fiku.getTmdbInfo(id, 'credits').then(credits => {
          this.API.fiku.getTmdbInfo(id).then(body => {
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
      }))
    },
    trailer(user, params, meta) {
      this.API.fiku.getFiku(params).then(fiku => {
        this.API.fiku.getTmdbId(fiku.title).then((id) => {
          const addTrailer = lng => {
            this.API.fiku.getTmdbInfo(id, 'videos', lng).then(({ results }) => {
              if (!results.length) {
                if (!lng) addTrailer('en')
                else this.sendMessage('Keine Ergebnisse /elo')
                return
              }
              const trailer = results.reduce((a, b) => a.size > b.size ? a : b)
              if (trailer.site != 'YouTube') return
              this.addNetzm(trailer.key, true, user, 'yt')
            })
          }
          addTrailer()
        })
      })
    }
  }
}
