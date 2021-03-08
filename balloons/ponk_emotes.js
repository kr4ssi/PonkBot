/*!
**|   PonkBot emotes
**@
*/

'use strict';

const CyTubeClient = require('../lib/client.js');

const fs = require('fs')
const URL = require('url')
const path = require('path')
const stream = require('stream')
const crypto = require('crypto')
const fetch = require('node-fetch')
const validUrl = require('valid-url')
const fileType = require('file-type')
const FormData = require('form-data')
const Gitlab = require('gitlab').Gitlab
const UserAgent = require('user-agents')
const simpleGit = require('simple-git/promise')

class Emotes {
  constructor(ponk) {
    Object.assign(this, {
      backuppath    : path.join(__dirname, '..', '..', 'testbackup'),
      backupData    : {},
      emotespath    : path.join(__dirname, '..', '..', 'emotes', 'public', ponk.channel),
      gitclient     : new Gitlab({
        token       : ponk.API.keys.gitlab    // Gitlab-token
      }),
      headers       : { 'User-Agent': (new UserAgent()).toString() },
      gitrepo       : ponk.API.keys.gitrepo,  // Gitlab-repo to backup to
      emotePromise  : Promise.resolve(),      // To chain emote-downloads
      filenames     : new Map(),              // The Emote-filenames
      emoteCSS      : '',                     // The Emote-CSS
      botCSS        : '',                     // The Bot-CSS
      otherEmotes   : {},                     // Emotes of other Channels
      lastCSS       : {                       // Several recent CSS-options
        logo        : '',
        hintergrund : ''
      },
      bot           : ponk                    // The Bot
    })
    this.bot.db.createTableIfNotExists('emotes', (table) => {
      table.string('emote', 240).primary()
      table.integer('count').defaultTo(0);
      table.string('lastuser', 20)
      table.integer('width').defaultTo(null);
      table.integer('height').defaultTo(null);
      table.boolean('flip').defaultTo(null);
      table.boolean('flop').defaultTo(null);
    }).then(() => this.createEmoteCSS())
    //const keepnames = new Set()
    this.bot.server.host.get('/emotes.css', (req, res) => {
      res.setHeader('Content-Type', 'text/css')
      res.send(this.emoteCSS)
    })
    this.bot.server.host.get('/bot.css', (req, res) => {
      res.setHeader('Content-Type', 'text/css')
      res.send(this.botCSS)
    })
    this.bot.server.host.get('/emotes.json', (req, res) => {
      res.json(this.bot.emotes.map(({ name, image }) => ({ name, image })))
    })
    this.bot.client.prependListener('channelCSSJS', cssjs => {
      const stripNoCache = (css = '') => css.replace(/\/(?:emotes|bot)\.css\?[^"]+/, '')
      if (stripNoCache(cssjs.css) != stripNoCache(this.bot.channelCSSJS.css))
      this.pushToGit('channel.css', cssjs.css)
      if (cssjs.js != this.bot.channelCSSJS.js)
      this.pushToGit('channel.js', cssjs.js)
    })
    this.bot.client.prependListener('chatFilters', filters => {
      //if (filters != this.bot.chatFilters)
      filters = this.bot.chatFilters.filter(filter => filter.name.startsWith('Bot filter'))
      this.pushToGit('filters.json', JSON.stringify(filters, null, 2))
    })
    this.bot.client.on('updateChatFilter', filter => {
      if (filter.name.startsWith('Bot filter')) return
      const filters = this.bot.chatFilters.filter(filter => filter.name.startsWith('Bot filter'))
      this.pushToGit('filters.json', JSON.stringify(filters, null, 2))
    })
    this.bot.client.on('deleteChatFilter', filter => {
      if (filter.name.startsWith('Bot filter')) return
      const filters = this.bot.chatFilters.filter(filter => filter.name.startsWith('Bot filter'))
      this.pushToGit('filters.json', JSON.stringify(filters, null, 2))
    })
    this.bot.client.prependListener('setMotd', motd => {
      if (motd != this.bot.channelMotd) this.pushToGit('motd.html', motd)
    })
    const stripNoCache = css => css.replace(/\/(?:emotes|bot)\.css\?[^"]+/, '')
    const filters = this.bot.chatFilters.filter(filter => filter.name != 'Bot filter')


    if (!fs.existsSync(this.emotespath)) fs.mkdirSync(this.emotespath)
    else fs.readdirSync(this.emotespath).forEach(filename => {
      const stat = fs.statSync(path.join(this.emotespath, filename))
      if (stat.isFile()) this.filenames.set(path.parse(filename).name, filename)
      else if (stat.isDirectory()) {
        if (filename === 'xmas')
        this.xmasfilenames = fs.readdirSync(path.join(this.emotespath, 'xmas'))
        else if (filename === '_bak')
        this.bakfilenames = fs.readdirSync(path.join(this.emotespath, '_bak'))
      }
    })
    if (!this.bakfilenames) {
      fs.mkdirSync(path.join(this.emotespath, '_bak'))
      this.bakfilenames = []
    }
    this.bot.client.prependListener('updateEmote', ({ name, image }) => {
      const emote = this.bot.emotes.find(emote => emote.name === name)
      if (!emote) this.bot.sendMessage(`Emote ${name} addiert.`)
      else this.bot.sendMessage(`Emote "${name}" wurde geändert von ${emote.image} zu ${image}.pic`)
      this.checkEmote({ name, image }, false)
    })
    this.bot.client.on('removeEmote', ({ name, image, source }) => {
      const linkedfilename = path.basename(URL.parse(image).pathname)
      this.removeEmote(this.cleanName(name) + path.extname(linkedfilename))
    })
    this.bot.client.on('renameEmote', ({ name, old, source }) => {
      const emote = this.bot.emotes.find(emote => emote.name === name)
      const linkedfilename = path.basename(URL.parse(emote.image).pathname)
      const shouldfilename = this.cleanName(name) + path.extname(linkedfilename)
      const oldfilename = this.cleanName(old) + path.extname(linkedfilename)
      this.renameEmote(oldfilename, shouldfilename)
      this.removeEmote(oldfilename)
    })
    fs.promises.mkdir(this.backuppath).catch(err => {
      if (err.code != 'EEXIST') throw err
      return fs.promises.lstat(this.backuppath).then(lstat => {
        if (!lstat.isDirectory()) throw err
      })
    })
    this.gitpromise = this.gitclient.Repositories.tree(this.gitrepo, {
      recursive: true,
      per_page: 5000,
    }).then(items => {
      this.gitfiles = new Set(items.map(item => item.path))
      //console.log(this.gitfiles)
    }, console.error)                        // To chain gitlab-commits
    if (this.bot.emotes.length) this.checkEmotes()
    else this.bot.client.once('emoteList', list => this.checkEmotes(list))
  }
  getEmoteData(dir) {
    const emotespath = path.join(dir, 'emotes')
    return fs.promises.mkdir(dir).catch(err => {
      if (err.code != 'EEXIST') throw err
      return fs.promises.lstat(dir).then(lstat => {
        if (!lstat.isDirectory()) throw err
        return fs.promises.mkdir(emotespath).catch(err => {
          if (err.code != 'EEXIST') throw err
          return fs.promises.lstat(emotespath).then(lstat => {
            if (!lstat.isDirectory()) throw err
          })
        })
      })
    }).then(() => fs.promises.readFile(path.join(dir, 'emotes.json'), {
      encoding: 'utf8'
    }).then(file => JSON.parse(file)).then(oldemotes => {
      return oldemotes.reduce((acc, emote) => acc.then(olddata => {
        return Promise.resolve().then(() => {
          if (!emote.filename) return
          const filepath = path.join(emotespath, emote.filename)
          return fs.promises.lstat(filepath).then(stats => {
            if (!stats.isFile()) throw new Error(emote.filename + ' is not a file')
          }).catch(err => {
            console.error(err)
            delete emote.filename
          })
        }).then(() => Object.assign(olddata, {
          [this.cleanName(emote.name)]: emote
        }))
      }), Promise.resolve({}))
    })).catch(err => {
      console.error(err)
      return {}
    }).then(olddata => fs.promises.readdir(emotespath, {
      withFileTypes: true
    }).then(files => {
      return files.reduce((acc, file) => acc.then(olddata => {
        return Promise.resolve().then(() => {
          if (!file.isFile()) throw new Error(file.name + ' is not a file')
          const name = path.parse(file.name).name
          if (!olddata[name]) olddata[name] = {}
          olddata[name].filename = file.name
        }).catch(console.error).then(() => olddata)
      }), Promise.resolve(olddata))
    }))
  }
  backupEmotes(emotes, client = this.bot.client) {
    const chan = client.chan
    const dir = path.join(this.backuppath, chan)
    Promise.resolve().then(() => {
      if (!emotes) throw new Error('No emotes-list found')
      return this.backupData[chan] || this.getEmoteData(dir)
    }).then(olddata => {
      this.backupData[chan] = {}
      //console.log(olddata)
      return emotes.reduce((acc, emote, i) => acc.then(() => {
        if (i > 20) return
        const old = olddata[this.cleanName(emote.name)]
        if (old && old.filename) {
          if (emote.image === old.image) return old.filename
        }
        return this.downloadEmote(emote, chan, false).catch(err => {
          client.chat({ msg: `${emote.name} ${err.message}`})
        })
      }).then(filename => {
        if (!filename) return
        const name = path.parse(filename).name
        this.backupData[chan][name] = Object.assign(emote, { filename })
      }), Promise.resolve())
    }).then(() => {
      const emotespath = path.join(dir, 'emotes.json')
      const emotesjson = JSON.stringify(emotes, null, 2)
      return fs.promises.writeFile(emotespath, emotesjson).then(() => {
        const git = simpleGit(dir)
        return git.checkIsRepo().then(isrepo => {
          if (!isrepo) return git.init().addRemote('origin', 'https://some.git.repo')
        }).then(() => git.add('.').then(() => git.commit('backup')).then(() => {
          return git.push('origin', 'master').then(() => {
            return git.raw(['ls-files', '-s'])
          })
        }).then(console.log).catch(console.error))
      })
    })
  }
  scheduleEmote() {
    return this.emotePromise = this.emotePromise.then(() => {
      return this.downloadEmote(...arguments).catch(err => {
        console.error(err)
      })
    })
  }
  downloadEmote({ name, image }, chan = this.bot.channel, update = true) {
    return fetch(image, { headers: this.headers }).then(res => {
      if (!res.ok) throw new Error(res.statusText)
      return fileType.stream(res.body)
    }).then(stream => new Promise((resolve, reject) => {
      const filename = `${this.cleanName(name)}.${stream.fileType.ext}`
      /*const*/let filepath = path.join(this.backuppath, chan, 'emotes', filename)
      if (process.env.NODE_ENV === 'production') filepath = path.join(this.emotespath, filename)
      this.removeEmote(filepath)
      stream.pipe(fs.createWriteStream(filepath)).on('close', () => {
        if (update) this.bot.client.socket.emit('updateEmote', {
          name,
          image: this.bot.API.keys.emotehost + '/' + filename
        })
        this.filenames.set(path.parse(filename).name, filename)
        console.log(filename + ' written')
        fs.readFile(path.join(this.emotespath, filename), {
          encoding: 'base64'
        }, (err, data) => {
          if (err) return console.error(err)
          this.pushToGit('emotes/' + filename, data, 'base64')
        })
        resolve(filename)
      }).on('error', reject)
    }))
  }
  checkEmotes(emotes = this.bot.emotes) {
    if (process.env.NODE_ENV != 'production') return this.backupEmotes(emotes)
    let i = 0
    emotes.forEach(emote => {
      if (i > 20) return this.bot.sendMessage('checkier das nochmal')
      if (this.checkEmote(emote) instanceof Promise) i++
    })
  }
  checkEmote({ name, image }, rename = true) {
    if (image.startsWith(this.bot.API.keys.emotehost)) {
      const filename = path.basename(URL.parse(image).pathname)
      const shouldfilename = this.cleanName(name) + path.extname(filename)
      if (!this.filenames.has(path.parse(filename).name)) {
        if (!this.bakfilenames.includes(filename))
        return console.log(filename + ' not found')
        fs.copyFileSync(path.join(this.emotespath, '_bak', filename), path.join(this.emotespath, filename))
        this.filenames.set(path.parse(filename).name, filename)
      }
      if ((shouldfilename != filename) && rename)
      this.renameEmote(filename, shouldfilename, false)
    }
    else return this.scheduleEmote({ name, image })
  }
  removeEmote(filename) {
    if (!this.filenames.has(path.parse(filename).name)) return
    fs.renameSync(path.join(this.emotespath, filename), path.join(this.emotespath, '_bak', filename))
    this.bakfilenames.push(filename)
    this.filenames.delete(path.parse(filename).name)
    this.pushToGit('emotes/' + filename)
  }
  renameEmote(oldfilename, shouldfilename, add = true) {
    this.removeEmote(shouldfilename)
    fs.copyFileSync(path.join(this.emotespath, oldfilename), path.join(this.emotespath, shouldfilename))
    //this.bot.client.socket.emit('updateEmote', { name: oldfilename, image: this.bot.API.keys.emotehost + '/' + shouldfilename})
    if (add) this.filenames.set(path.parse(shouldfilename).name, shouldfilename)
    this.pushToGit('emotes/' + oldfilename)
    fs.readFile(path.join(this.emotespath, shouldfilename), {
      encoding: 'base64'
    }, (err, data) => {
      if (err) return console.log(err)
      this.pushToGit('emotes/' + shouldfilename, data, 'base64')
    })
  }
  pushToGit(filename, content, encoding) {
    const opt = {}
    if (encoding) opt.encoding = encoding
    const gitArgs = [this.gitrepo, filename, 'master']
    return this.gitpromise = this.gitpromise.then(() => {
      if (this.gitfiles.has(filename)) {
        if (content) return fetch(`https://gitlab.com/api/v4/projects/${this.gitrepo}/repository/files/${filename}?ref=master`, {
          method: 'HEAD',
          headers: { 'PRIVATE-TOKEN': this.bot.API.keys.gitlab }
        }).then(res => {
          console.log(res)
          const sha256 = crypto.createHash('sha256').update(content).digest('hex')
          if (sha256 != res.headers.get('x-gitlab-content-sha256')) {
            opt.commit_message = 'updated ' + filename
            gitArgs.push(content, opt.commit_message, opt)
            return this.gitclient.RepositoryFiles.edit(...gitArgs).then(result => {
              console.log('edited', result)
            })
          }
        })
        else {
          opt.commit_message = 'deleted ' + filename
          gitArgs.push(opt.commit_message, opt)
          return this.gitclient.RepositoryFiles.remove(...gitArgs).then(result => {
            console.log('deleted', result)
            this.gitfiles.delete(result.file_path)
          })
        }
      }
      else if (content) {
        opt.commit_message = 'created ' + filename
        gitArgs.push(content, opt.commit_message, opt)
        return this.gitclient.RepositoryFiles.create(...gitArgs).then(result => {
          console.log('created', result)
          this.gitfiles.add(result.file_path)
        })
      }
    }).catch(console.error)
  }
  createEmoteCSS() {
    return this.bot.db.knex('emotes').whereNotNull('width').orWhereNotNull('height').orWhereNotNull('flip').orWhereNotNull('flop')
    .select('emote', 'width', 'height', 'flip', 'flop').then(sizes => {
      return this.emoteCSS = sizes.reduce((css, size) => {
        const setwidth = (size.width > 0) && (size.width != 100)
        const setheight = (size.height > 0) && (size.height != 100)
        if (!setwidth && !setheight && !size.flip && !size.flop) return css
        css += `.channel-emote[title="${size.emote}"] ` + '{\r\n'
        if (size.flip)
        css += `  transform: scaleY(-1);\r\n`
        if (size.flop)
        css += `  transform: rotate(180deg);\r\n`
        if (setwidth)
        css += `  max-width: ${(size.width < 999) ? (size.width + 'px') : '100%'} !important;\r\n`
        if (setheight)
        css += `  max-height: ${(size.height < 999) ? (size.height + 'px') : '100%'} !important;\r\n`
        return css += `}\r\n`
      }, '')
    })
  }
  cssReplace(command, addCSS) {
    let css = this.bot.channelCSSJS.css
    //let css = this.bot.API.emotes.botCSS
    const tagText = `Bot-CSS "${command}" do not edit`
    const tagRegEx = `\\/\\*\\s${tagText}\\s\\*\\/`
    const tagMatch = css.match(new RegExp(`\\s${tagRegEx}([\\S\\s]+)${tagRegEx}`, 'i'))
    const cssNew = `\n/* ${tagText} */\n${addCSS || this.lastCSS[command]}\n/* ${tagText} */`
    if (tagMatch) {
      const cssOld = tagMatch[1].trim()
      if (cssOld.length && this.lastCSS[command] != cssOld)
      this.lastCSS[command] = cssOld
      css = css.replace(tagMatch[0], cssNew)
    }
    else css += cssNew
    this.bot.client.socket.emit('setChannelCSS', { css })
    //this.bot.API.emotes.botCSS = css
    //this.bot.client.socket.emit('setChannelCSS', {css: this.bot.channelCSS.replace(/\/bot\.css\?[^"]+/, '/bot.css?' + Date.now())})
  }
  logoHintergrund(user, params, meta) {
    const command = {
      logo: {
        css1: '#leftpane-inner:after { background-image:url("',
        css2: '"); }',
        message: 'Verfügbare Logos: ',
        options: Object.fromEntries(this.bot.emotes.filter(({ name }) => {
          return name.startsWith('/logo')
        }).map(({ name, image }) => [name.slice(5), image]))
      },
      hintergrund: {
        css1: 'body { background-image:url("',
        css2: '"); }',
        message: 'Verfügbare Hintergründe: ',
        options: Object.fromEntries(this.bot.emotes.filter(({ name }) => {
          return name.startsWith('/bg')
        }).map(({ name, image }) => [name.slice(3), image]))
      }
    }[meta.command]
    if (params) {
      if (params === 'last') this.cssReplace(meta.command)
      else {
        if (command.options[params.toLowerCase()]) params = command.options[params.toLowerCase()]
        else {
          const emote = params.match(/^\/[\wäÄöÖüÜß]+/) && this.bot.emotes.find(emote => emote.name == params)
          if (emote) params = emote.image
        }
        console.log(params)
        params = validUrl.isHttpsUri(params)
        if (!params) return this.bot.sendMessage('Ist keine https-Elfe /pfräh')
        this.cssReplace(meta.command, command.css1 + params + command.css2)
      }
    }
    else this.bot.sendByFilter(command.message + Object.keys(command.options).join(', '))
  }
  cleanName(name) {
    return name.replace(/^\//, '').replace(/["*/:<>?\\()|]/g, match => ({
      '"': 'gänsefüßchen',
      '*': 'sternchen',
      '/': 'schrägstrich',
      ':': 'doppelpunkt',
      '<': 'spitzeklammerauf',
      '>': 'spitzeklammerzu',
      '(': 'klammerauf',
      ')': 'klammerzu',
      '?': 'fragezeichen',
      '\\': 'backslash',
      '|': 'senkrechterstrich'
    })[match])
  }
}

module.exports = {
  meta: {
    active: true,
    type: 'giggle'
  },
  giggle(ponk){
    return new Promise((resolve, reject) => {
      ponk.API.emotes = new Emotes(ponk);
      ponk.logger.log('Registering emotes');
      resolve()
    })
  },
  handlers: {
    rehost(user, params, meta) {
      const host = this.API.keys.imagehost
      Promise.resolve().then(() => {
        if (!params || params.match(/^[1-9]$/))
        return this.getLastImage(Number(params))
        const emote = params.match(/^\/[\wäÄöÖüÜß]+/) && this.emotes.find(emote => emote.name == params)
        if (emote) params = emote.image
        const url = validUrl.isHttpsUri(params)
        if (url) return url
        throw { err: url, msg: 'Ist keine https-Elfe /pfräh' }
      }).then(url => fetch(url, {
        headers: { 'User-Agent': (new UserAgent()).toString() }
      }).then(res => {
        return fileType.stream(res.body).then(stream => {
          const filename = path.parse(URL.parse(url).pathname).name
          const form = new FormData()
          form.append('format', 'json')
          form.append('file', stream, {
            filename: `${filename}.${stream.fileType.ext}`,
            contentType: stream.fileType.mime,
            knownLength: res.headers.get('content-length')
          })
          return fetch(host, {
            method: 'POST',
            body: form,
            headers: { 'User-Agent': (new UserAgent()).toString() }
          }).then(res => res.json())
        })
      })).then(body => {
        if (body.msg && body.msg.short) return host + body.msg.short
        throw { err: body, message: 'parsing error' }
      }).then(image => this.addLastImage(image)).then(image => {
        this.sendMessage(image + '.pic')
      }).catch(err => {
        if (err.message) return this.sendMessage(err.message)
        console.error(err)
      })
    },
    mützen(user, params, meta) {
      this.db.getKeyValue('xmasemotes').then(xmasemotes => {
        if (xmasemotes) this.db.setKeyValue('xmasemotes', 1).then(() => {
          fs.readdir(path.join(__dirname, '..', '..', 'emotes', 'public', 'xmas'), (err, filenames) => {
            if (err) return console.log(err)
            this.emotes.forEach(({ name, image }) => {
              if (/(?:\/xmas\/)/.test(image)) return
              const regExp = new RegExp(`^${this.API.emotes.cleanName(name)}\\.[^.]+$`)
              const filename = filenames.find(filename => regExp.test(filename))
              if (filename) this.client.socket.emit('updateEmote', {
                name,
                image: image.replace(filename, 'xmas/' + filename)
              })
            })
          })
        })
        else this.db.setKeyValue('xmasemotes', 0).then(() => {
          this.emotes.forEach(({ name, image }) => {
            if (/(?:\/xmas\/)/.test(image)) this.client.socket.emit('updateEmote', {
              name,
              image: image.replace('/xmas', '')
            })
          })
        })
      })
    },
    emote(user, params, meta) {
      const split = params.trim().split(' ')
      const emote = split.shift().trim()
      if (!emote.match(/^\/[\wäÄöÖüÜß]+$/) || !this.emotes.some(emotelist => emotelist.name == emote))
      return this.sendMessage('Ist kein emote')
      if (!split.length) return this.db.knex('emotes').where({ emote })
      .select('count', 'lastuser', 'width', 'height').then(result => {
        const {
          count = 0,
          width = 0,
          height = 0,
          lastuser
        } = result.pop() || {}
        let info = lastuser ? `. Zuletzt von: ${lastuser}` : ''
        if (width > 0 && width != 100)
        info += `. Maximale Breite: ${width < 999 ? width + 'px' : '100%'}`
        if (height > 0 && height != 100)
        info += `. Maximale Höhe: ${height < 999 ? height + 'px' : '100%'}`
        this.sendMessage(`Emote ${params} wurde ${count} mal pfostiert${info}`)
      })
      const size = split.reduce((size, param) => {
        let match
        if (match = param.trim().match(/(w|h)(\d{1,4})/)) {
          if (match[1] === 'w') size.width = match[2]
          else if (match[1] === 'h') size.height = match[2]
        }
        else if (param.trim() === 'flip') size.flip = true
        else if (param.trim() === 'flop') size.flop = true
        return size
      }, {})
      if (!Object.keys(size).length)
      return this.sendMessage('Zu wenig parameter')
      Promise.resolve().then(() => {
        if (size.flip || size.flop)
        return this.db.knex('emotes').where({ emote }).select('flip', 'flop').then(result => {
          result = result.pop() || {}
          if (size.flip) size.flip = !result.flip
          if (size.flop) size.flop = !result.flop
        })
      }).then(() => {
        return this.db.knex('emotes').insert({ emote, ...size })
      }).catch(() => {
        return this.db.knex('emotes').where({ emote }).update(size)
      }).then(() => this.API.emotes.createEmoteCSS()).then(() => {
        this.API.emotes.pushToGit('emotes.css', this.API.emotes.emoteCSS)
        this.client.socket.emit('setChannelCSS', {
          css: this.channelCSSJS.css.replace(/\/emotes\.css\?[^"]+/, '/emotes.css?' + Date.now())
        })
      })
    },
    addemote(user, params, meta) {
      if (!params.match(/^\/[\wäÄöÖüÜß]+/))
      return this.sendMessage('Muss mit / anfangen und aus Buchstaben, oder Zahlen bestehen')
      const split = params.trim().split(' ')
      const name = split.shift()
      let image = split.join().trim()
      if (!image) return this.getLastImage().then(image => {
        this.API.emotes.scheduleEmote({ name, image })
      })
      image = validUrl.isHttpsUri(image)
      if (!image) return this.sendMessage('Ist keine https-Elfe /pfräh')
      this.API.emotes.scheduleEmote({ name, image })
    },
    getemote(user, params, meta) {
      const split = params.trim().split(' ')
      const chan = split.shift()
      const name = split.pop()
      new Promise((resolve, reject) => {
        if (this.API.emotes.otherEmotes[chan] && name != 'update')
        return resolve(this.API.emotes.otherEmotes[chan])
        const { host, port, secure, user, auth, socket } = this.client
        const client = new CyTubeClient({
          host, port, secure, user, auth, chan
        }, this.log).once('ready', () => {
          client.connect()
        }).once('connected', () => {
          client.socket.emit = socket.emit.bind(client.socket)
          client.start()
        }).once('emoteList', emotelist => {
          resolve(this.API.emotes.otherEmotes[chan] = emotelist)
          client.socket.close()
        }).on('error', reject)
      }).catch(console.error).then(emotelist => {
        if (!name || !name.match(/^\/[\wäÄöÖüÜß]+/))
        return this.sendMessage('Muss mit / anfangen und aus Buchstaben, oder Zahlen bestehen')
        const emote = emotelist.find(emote => emote.name == name)
        if (!emote) return this.sendMessage('Emote nicht gefunden')
        if (split.pop() === 'add') this.API.emotes.scheduleEmote(emote)
        else this.sendMessage(emote.image + '.pic')
      })
    },
    logo() {
      this.API.emotes.logoHintergrund(...arguments)
    },
    hintergrund() {
      this.API.emotes.logoHintergrund(...arguments)
    }
  }
}
