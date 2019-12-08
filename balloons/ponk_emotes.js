/*!
**|   PonkBot emotes
**@
*/

'use strict';
const path = require('path')
const request = require('request')
const fs = require('fs')
const fileType = require('file-type')
const stream = require('stream')
const URL = require('url')

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
      bot         : ponk   // The bot
    })
    this.emotespath = path.join(__dirname, '..', '..', 'emotes', 'public')
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
    if (this.bot.emotes.length < 1) this.bot.client.once('emoteList', (list) => {
      this.checkEmotes(list)
    })
    else this.checkEmotes()
    fs.readdir(path.join(this.emotespath, 'xmas'), (err, filenames) => {
      if (err) return console.log(err)
      //console.log(filenames)
    })
    this.bot.client.prependListener('updateEmote', ({ name, image }) => {
      const emote = this.bot.emotes.find(emote => emote.name === name)
      if (!emote) this.bot.sendMessage(`Emote ${name} addiert.`)
      else this.bot.sendMessage(`Emote "${name}" wurde geändert von ${emote.image} zu ${image}.pic`)
      const linkedname = path.basename(URL.parse(image).pathname)
      const filename = name.slice(1).replace(/[:()]/g, '\\$&')
      const extfilename = filename + path.extname(linkedname)
      if (image.startsWith(this.bot.API.keys.emotehost)) {
        if (!this.filenames.has(extfilename)) this.recoverEmote(extfilename)
      }
      else this.downloadEmote(name, filename, image)
    })
    this.bot.client.on('removeEmote', ({ name, image, source }) => {
      const linkedname = path.basename(URL.parse(image).pathname)
      const filename = name.slice(1).replace(/[:()]/g, '\\$&') + path.extname(linkedname)
      this.removeEmote(filename)
    })
    this.bot.client.on('renameEmote', ({ name, old, source }) => {
      const emote = this.bot.emotes.find(emote => emote.name === name)
      const linkedname = path.basename(URL.parse(emote.image).pathname)
      const shouldname = name.slice(1).replace(/[:()]/g, '\\$&') + path.extname(linkedname)
      const oldname = old.slice(1).replace(/[:()]/g, '\\$&') + path.extname(linkedname)
      this.renameEmote(oldname, shouldname)
      this.removeEmote(oldname)
    })
  }
  checkEmotes (emotes) {
    (emotes || this.bot.emotes).forEach(({ name, image }) => {
      const filenname = name.slice(1).replace(/[:()<>]/g, '\\$&')
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
    this.bot.pushToGit('emotes/' + filename)
  }
  renameEmote(oldname, shouldname, add = true) {
    this.removeEmote(shouldname)
    fs.copyFileSync(path.join(this.emotespath, oldname), path.join(this.emotespath, shouldname))
    if (add) this.filenames.add(shouldname)
    this.bot.pushToGit('emotes/' + oldname)
    fs.readFile(path.join(this.emotespath, shouldname), {encoding: 'base64'}, (err, data) => {
      if (err) return console.log(err)
      this.bot.pushToGit('emotes/' + shouldname, data, 'base64')
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
          this.bot.pushToGit('emotes/' + filename, data, 'base64')
        })
      }))
    }).catch(err => console.log(err))
  }
}

module.exports = {
  meta: {
    active: true,
    type: 'giggle'
  },
  giggle: function(ponk){
    return new Promise((resolve, reject) => {
      Object.assign(ponk, {
        pushToGit: function(filename, content, encoding) {
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
              if (waiting.length) ponk.pushToGit(...waiting.shift())
              resolve()
            }).catch(err => {
              if (!!content && err.response && err.response.status == 400 && err.description === 'A file with this name doesn\'t exist') {
                gitObj.commit_message = 'created ' + filename
                gitclient.RepositoryFiles.create(...gitArr).then(result => {
                  count--
                  if (waiting.length) ponk.pushToGit(...waiting.shift())
                  resolve()
                }).catch(err => {
                  console.error(err)
                  count--
                  if (waiting.length) ponk.pushToGit(...waiting.shift())
                })
              }
              else {
                console.error(err)
                count--
                if (waiting.length) ponk.pushToGit(...waiting.shift())
              }
            })
          })
        }
      })
      ponk.API.emotes = new Emotes(ponk);
      ponk.logger.log('Registering emotes');
      resolve()
    })
  },
  handlers: {
    //emote: function(user, params, meta) {

    //}
  }
}
