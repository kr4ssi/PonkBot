/*!
**|   PonkBot emotes
**@
*/

'use strict';

const CyTubeClient = require('../lib/client.js');

const path = require('path')
const request = require('request')
const fs = require('fs')
const fileType = require('file-type')
const stream = require('stream')
const URL = require('url')
const validUrl = require('valid-url')

const Gitlab = require('gitlab').Gitlab

const gitclient = new Gitlab({
  token: process.env.api_gitlab
})
const gitrepo = process.env.gitrepo
let count = 0
const waiting = []

class Emotes {
  constructor(ponk) {
    Object.assign(this, {
      emoteCSS    : '',    // The emote CSS
      otherEmotes : {},
      bot         : ponk   // The bot
    })
    this.createEmoteCSS()
    this.bot.server.host.get('/emotes.css', (req, res) => {
      res.setHeader('Content-Type', 'text/css')
      res.send(this.emoteCSS)
    })
    this.bot.server.host.get('/emotes.json', (req, res) => {
      res.json(ponk.emotes.map(emote => ({name: emote.name, image: emote.image})))
    })
    if (process.env.NODE_ENV === 'production') return
    this.emotespath = path.join(__dirname, '..', '..', 'emotes', 'public')
    this.cleanName = name => name.slice(1).replace(/["*/:<>?\\|]/g, match => ({
      '"': 'gänsefüßchen',
      '*': 'sternchen',
      '/': 'schrägstrich',
      ':': 'doppelpunkt',
      '<': 'spitzeklammerauf',
      '>': 'spitzeklammerzu',
      '?': 'fragezeichen',
      '\\': 'backslash',
      '|': 'senkrechterstrich'
    })[match])
    this.filenames = new Set()
    const keepnames = new Set()
    fs.readdirSync(this.emotespath).forEach(filename => {
      const stat = fs.statSync(path.join(this.emotespath, filename))
      if (stat.isFile()) this.filenames.add(filename)
      else if (stat.isDirectory()) {
        if (filename === 'xmas') this.xmasfilenames = fs.readdirSync(path.join(this.emotespath, 'xmas'))
        else if (filename === '_bak') this.bakfilenames = fs.readdirSync(path.join(this.emotespath, '_bak'))
      }
    })
    if (!this.bakfilenames) {
      fs.mkdirSync(path.join(this.emotespath, '_bak'))
      this.bakfilenames = []
    }
    if (this.bot.emotes.length > 0) this.checkEmotes()
    else this.bot.client.once('emoteList', list => this.checkEmotes(list))
    this.bot.client.prependListener('updateEmote', ({ name, image }) => {
      const emote = this.bot.emotes.find(emote => emote.name === name)
      if (!emote) this.bot.sendMessage(`Emote ${name} addiert.`)
      else this.bot.sendMessage(`Emote "${name}" wurde geändert von ${emote.image} zu ${image}.pic`)
      const linkedname = path.basename(URL.parse(image).pathname)
      const filename = this.cleanName(name)
      const extfilename = filename + path.extname(linkedname)
      if (image.startsWith(this.bot.API.keys.emotehost)) {
        if (!this.filenames.has(extfilename)) this.recoverEmote(extfilename)
      }
      else this.downloadEmote(name, filename, image)
    })
    this.bot.client.on('removeEmote', ({ name, image, source }) => {
      const linkedname = path.basename(URL.parse(image).pathname)
      const filename = this.cleanName(name) + path.extname(linkedname)
      this.removeEmote(filename)
    })
    this.bot.client.on('renameEmote', ({ name, old, source }) => {
      const emote = this.bot.emotes.find(emote => emote.name === name)
      const linkedname = path.basename(URL.parse(emote.image).pathname)
      const shouldname = this.cleanName(name) + path.extname(linkedname)
      const oldname = this.cleanName(old) + path.extname(linkedname)
      this.renameEmote(oldname, shouldname)
      this.removeEmote(oldname)
    })
  }
  checkEmotes (emotes) {
    (emotes || this.bot.emotes).forEach(({ name, image }) => {
      const filenname = this.cleanName(name)
      if (image.startsWith(this.bot.API.keys.emotehost)) {
        const linkedname = path.basename(URL.parse(image).pathname)
        const shouldname = filenname + path.extname(linkedname)
        if (!this.filenames.has(linkedname) && !this.recoverEmote(linkedname)) return console.log(image)
        if (shouldname != linkedname) this.renameEmote(linkedname, shouldname, false)
      }
      else this.downloadEmote(name, filenname, image)
    })
  }
  removeEmote(filename) {
    if (!this.filenames.has(filename)) return
    fs.renameSync(path.join(this.emotespath, filename), path.join(this.emotespath, '_bak', filename))
    this.bakfilenames.push(filename)
    this.filenames.delete(filename)
    this.pushToGit('emotes/' + filename)
  }
  renameEmote(oldname, shouldname, add = true) {
    this.removeEmote(shouldname)
    fs.copyFileSync(path.join(this.emotespath, oldname), path.join(this.emotespath, shouldname))
    if (add) this.filenames.add(shouldname)
    this.pushToGit('emotes/' + oldname)
    fs.readFile(path.join(this.emotespath, shouldname), {encoding: 'base64'}, (err, data) => {
      if (err) return console.log(err)
      this.pushToGit('emotes/' + shouldname, data, 'base64')
    })
  }
  recoverEmote(filename) {
    if (!this.bakfilenames.includes(filename)) return console.log(filename + ' not found')
    fs.copyFileSync(path.join(this.emotespath, '_bak', filename), path.join(this.emotespath, filename))
    this.filenames.add(filename)
    return true
  }
  downloadEmote(name, filename, image) {
    const pass = new stream.PassThrough();
    const r = request.get(image).on('error', err => {
      console.error(image, err);
    })
    r.pipe(pass)
    fileType.stream(pass).then(stream => {
      filename = filename + '.' + stream.fileType.ext
      stream.pipe(fs.createWriteStream(path.join(this.emotespath, filename)).on('close', () => {
        this.bot.client.socket.emit('updateEmote', { name, image: this.bot.API.keys.emotehost + '/' + filename})
        this.filenames.add(filename)
        console.log(filename + ' written')
        fs.readFile(path.join(this.emotespath, filename), {encoding: 'base64'}, (err, data) => {
          if (err) return console.log(err)
          this.pushToGit('emotes/' + filename, data, 'base64')
        })
      }))
    }).catch(err => console.log(err))
  }
  pushToGit(filename, content, encoding) {
    if (count > 0) return waiting.push(arguments)
    count++
    const gitObj = { commit_message: (!!content ? 'updated ' : 'deleted ') + filename}
    if (encoding) gitObj.encoding = encoding
    const gitArr = [gitrepo, filename, 'master']
    if (!!content) gitArr.push(content)
    gitArr.push(gitObj.commit_message, gitObj)
    return new Promise((resolve, reject) => {
      gitclient.RepositoryFiles[!!content ? 'edit' : 'remove'](...gitArr).then(result => {
        count--
        if (waiting.length) this.pushToGit(...waiting.shift())
        resolve()
      }).catch(err => {
        if (!!content && err.response && err.response.status == 400 && err.description === 'A file with this name doesn\'t exist') {
          gitObj.commit_message = 'created ' + filename
          gitclient.RepositoryFiles.create(...gitArr).then(result => {
            count--
            if (waiting.length) this.pushToGit(...waiting.shift())
            resolve()
          }).catch(err => {
            console.error(err)
            count--
            if (waiting.length) this.pushToGit(...waiting.shift())
          })
        }
        else {
          console.error(err)
          count--
          if (waiting.length) this.pushToGit(...waiting.shift())
        }
      })
    })
  }
  createEmoteCSS() {
    return new Promise((resolve, reject) => this.bot.db.knex('emotes').whereNotNull('width').orWhereNotNull('height').select('emote', 'width', 'height').then(sizes => {
      this.emoteCSS = sizes.filter(size => (((size.width > 0) && (size.width != 100)) || ((size.height > 0) && (size.height != 100)))).map(size => {
        return '.channel-emote[title="' + size.emote + '"] {\r\n' +
        ((size.width > 0) && (size.width != 100) ? ('  max-width: ' + ((size.width < 999) ? (size.width + 'px') : '100%') + ' !important;\r\n') : '') +
        ((size.height > 0) && (size.height != 100) ? ('  max-height: ' + ((size.height < 999) ? (size.height + 'px') : '100%') + ' !important;\r\n') : '') +
        '}'
      }).join('\r\n')
      resolve()
    }))
  }
}

module.exports = {
  meta: {
    active: true,
    type: 'giggle'
  },
  giggle: function(ponk){
    return new Promise((resolve, reject) => {
      ponk.API.emotes = new Emotes(ponk);
      ponk.pushToGit = ponk.API.emotes.pushToGit.bind(ponk)
      ponk.logger.log('Registering emotes');
      resolve()
    })
  },
  handlers: {
    addemote: function(user, params, meta) {
      if (!params.match(/^\/[\wäÄöÖüÜß]+/)) return this.sendMessage('Muss mit / anfangen und aus Buchstaben, oder Zahlen bestehen')
      const split = params.trim().split(' ')
      const name = split.shift()
      let image = split.join().trim()
      if (!image) return this.getLastImage().then(image => {
        this.client.socket.emit('updateEmote', { name, image })
      })
      image = validUrl.isHttpsUri(image)
      if (!image) return this.sendMessage('Ist keine https-Elfe /pfräh')
      if (/\.json$/.test(image)) return this.fetch(image, {
        json: true
      }).then(({ body }) => {
        const emote = body.find(emote => emote.name == name)
        if (!emote) return this.sendMessage('Emote nicht gefunden')
        this.client.socket.emit('updateEmote', { name, image: emote.image })
      })
      this.client.socket.emit('updateEmote', { name, image })
    },
    emote: function(user, params, meta) {
      if (!params.match(/^\/[\wäÄöÖüÜß]+$/) || !this.emotes.some(emote => emote.name == params)) return this.sendMessage('Ist kein emote')
      this.db.knex('emotes')
      .where({ emote: params })
      .select('count', 'lastuser', 'width', 'height')
      .then(result => {
        let count = 0
        let byuser = ''
        let width = 0
        let height = 0
        if (result.length > 0) {
          result = result.pop()
          count = result.count || 0
          width = result.width || 0
          height = result. height || 0
          if (result.lastuser) byuser = '. Zuletzt von: ' + result.lastuser
        }
        this.sendMessage('Emote ' + params + ' wurde ' + count + ' mal pfostiert' + byuser +
        ((width > 0) && (width != 100) ? ('. Maximale Breite: ' + ((width < 999) ? (width + 'px') : '100%')) : '') +
        ((height > 0) && (height != 100) ? ('. Maximale Höhe: ' + ((height < 999) ? (height + 'px') : '100%')) : ''))
      })
    },
    emotesize: function(user, params, meta) {
      const split = params.trim().split(' ')
      const emote = split.shift().trim()
      if (!emote.match(/^\/[\wäÄöÖüÜß]+$/) || !this.emotes.some(emotelist => emotelist.name == emote)) return this.sendMessage('Ist kein emote')
      const size = {};
      while (params = split.shift()) if (params = params.trim().match(/(w|h)(\d{1,4})/)) {
        if (params[1] === 'w') size.width = params[2]
        else if (params[1] === 'h') size.height = params[2]
      }
      if (!size.width && !size.height) return this.sendMessage('Zu wenig parameter')
      this.db.knex('emotes').insert({ emote, ...size }).catch(() => {
        return this.db.knex('emotes').where({ emote }).update(size)
      }).then(() => {
        this.API.emotes.createEmoteCSS().then(() => this.pushToGit('emotes.css', this.API.emotes.emoteCSS).then(() => this.client.socket.emit('setChannelCSS', {
          css: this.channelCSS.replace(/\/emotes\.css\?[^"]+/, '/emotes.css?' + Math.random().toString(36).slice(2))
        })))
      })
    },
    mützen: function(user, params, meta) {
      this.db.getKeyValue('xmasemotes').then(xmasemotes => {
        console.log(xmasemotes)
        if (xmasemotes != 1) {
          this.db.setKeyValue('xmasemotes', 1);
          fs.readdir(path.join(__dirname, '..', '..', 'emotes', 'public', 'xmas'), (err, filenames) => {
            if (err) return console.log(err)
            console.log(filenames)
            let i = 0
            this.emotes.forEach(({ name, image }) => {
              if (/\/xmas\//.test(image)) return
              const filename = filenames.find(filename => new RegExp('^' + name.slice(1).replace(/[:()]/g, '\\$&') + '\\.[^.]+$').test(filename))
              if (!filename) return
              const newfilename = image.replace(filename, 'xmas/' + filename)
              console.log(filename, newfilename)
              setTimeout(() => {
                this.client.socket.emit('updateEmote', { name, image: newfilename})
              }, i++ * 300)
            })
          })
        }
        else {
          this.db.setKeyValue('xmasemotes', 0)
          let i = 0
          this.emotes.forEach(({ name, image }) => {
            if (!/\/xmas\//.test(image)) return
            setTimeout(() => {
              this.client.socket.emit('updateEmote', { name, image: image.replace('/xmas', '')})
            }, i++ * 300)
          })
        }
      })
    },
    getemote: function(user, params, meta) {
      const split = params.trim().split(' ')
      const chan = split.shift()
      let name = split.shift()
      const getEmotes = (chan, update) => new Promise((resolve, reject) => {
        if (this.API.emotes.otherEmotes[chan] && !update) return resolve(this.API.emotes.otherEmotes[chan])
        const { host, port, secure, user, auth } = this.client
        const tempclient = new CyTubeClient({
          host, port, secure, user, auth, chan
        }, this.log).once('ready', function() {
          this.connect()
        }).once('connected', function() {
          this.start()
        }).once('emoteList', function(emotelist) {
          resolve(emotelist)
          this.socket.close()
        }).on('error', reject)
      })
      if (name === 'update') return getEmotes(chan, true).then(emotes => (this.API.emotes.otherEmotes[chan] = emotes))
      let add
      if (name === 'add') {
        name = split.shift()
        add = true
      }
      if (!name || !name.match(/^\/[\wäÄöÖüÜß]+/)) return this.sendMessage('Muss mit / anfangen und aus Buchstaben, oder Zahlen bestehen')
      getEmotes(chan).then(emotes => {
        this.API.emotes.otherEmotes[chan] = emotes
        const emote = emotes.find(emote => emote.name == name)
        if (!emote) return this.sendMessage('Emote nicht gefunden')
        if (add) this.client.socket.emit('updateEmote', { name, image: emote.image })
        else this.sendMessage(emote.image + '.pic')
      })
    }
  }
}
