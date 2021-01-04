/*!
**|   PonkBot Replacements
**@
*/

'use strict';

module.exports = function(ponk) {
  ponk.registerCooldown({
    type           : 'emit',
    name           : 'emit',
    personalType   : 'ignore',
    personalParams : null,
    sharedType     : 'bucket',
    sharedParams   : [10, 1, 'second', null],
  })
  const emit = ponk.client.socket.emit
  ponk.client.socket.emit = function() {
    ponk.checkCooldown({ type: 'emit', user: ponk.name, silent: true }).then(() => {
      emit.apply(this, arguments)
    }, message => setTimeout(() => {
      process.nextTick(() => {
        this.emit(...arguments)
      })
    }, 500))
  }
  Object.assign(ponk, {
    lastImages      : [],    // A list with lastly posted Images
    handlePrivateMessage({ username, msg }) {
      this.logger.log(`Private Message "${msg}" from: ${username}`);
    },
    handleChatMessage({ username: user, msg: message, time, meta }) {
      if (time < this.started) return
      const triggered = this.commands.trigger.test(this.filterChat(message))
      if (triggered) this.commandDispatcher(user, message)
      else if (!this.bots.concat('[server]').includes(user)) {
        let match
        let regex = /(?<=^|\s)(\/[a-zA-Z0-9ßäöüÄÖÜ]+)(?=\s|$)/g
        const emotes = {}
        while (match = regex.exec(message)) {
          const emote = this.emotes.find(emote => emote.name == match[1])
          if (!emote) continue
          if (!emotes[emote.name]) emotes[emote.name] = 1
          else emotes[emote.name]++
        }
        Object.keys(emotes).forEach(emote => {
          const count = emotes[emote]
          this.db.knex('emotes').insert({ emote, count, lastuser: user}).catch(() => {
            return this.db.knex('emotes').where({ emote }).increment({ count }).update({ lastuser: user })
          }).then(() => {
            //this.logger.log('Emote used: ' + emote + ' ' + count + ' times by ' + user)
          })
        })
        regex = /<img class="image-embed-small" src="(https?:\/\/[^"]+)" \/>/g
        while (match = regex.exec(message)) {
          this.addLastImage(match[1])
        }
        if (message.match(new RegExp('^' + this.name + '|[^!.$/]' + this.name))) {
          const quotes = [
            'Hiiiiiiii',
            'jaaaah?',
            'ja morgen',
            'w-was?',
            'lass mich',
            'hihi',
            'iiich?'
          ]
          if (user === 'melli17') this.sendMessage('/knuddeln')
          else this.sendMessage(quotes[Math.floor(Math.random() * quotes.length)])
        }
      }
      this.emit('message', { time, user, message });
    },
    commandDispatcher(user, message){
      let split = this.filterChat(message).split(' ');
      const command = split.shift().slice(1);
      let params = split.join(' ').trim();
      if(this.bots.includes(user)){
        this.logger.debug(`Command ${command} invoked by self or peer.`);
        return;
      }
      if(this.commands.blacklist.includes(user)){
        this.logger.debug(`Command ${command} invoked by blacklisted user ${user}.`);
        return;
      }
      if(this.commands.disabled.includes(command)){
        this.logger.debug(`Disabled command ${command} invoked.`);
        return;
      }
      if (command in this.commands.handlers){
        this.userCheckBarred(user).then((barred)=>{
          if(barred){
            return this.sendPrivate('You are barred from issuing commands to this bot.', user);
          }
          this.logger.log('Received command dispatch', command);
          const rank = this.getUserRank(user);
          const needrank = this.commands.helpdata[command].rank;
          if (rank < needrank) return this.sendMessage('Geht nur ab lvl ' + needrank);
          let addnext = this.commands.helpdata[command].addnext
          if (addnext) {
            const cleanparams = params.replace(new RegExp(addnext + '$'), '').trim()
            addnext = params != cleanparams
            params = cleanparams
          }
          let repeat = this.commands.helpdata[command].repeat
          if (repeat) {
            repeat = 1
            params = params.replace(/(?:^|\s)\d{1,2}$/, match => {
              if (rank > 3) repeat = Math.min(5, match.trim())
              return ''
            }).trim()
          }
          this.logger.command(`${user} invoked ${command} with ${params ? params : 'no params.'}`);
          this.commands.handlers[command](user, params, { command, message, rank, addnext, repeat });
        });
      }
    },
    sendMessage(message, meta = {}){
      if(!this.meeseeks('chat')){
        this.logger.error('Unable to send chat messages due to restrictive channel permissions');
        return;
      }
      // Future home of other stuff like modflair and color overrides
      const { ignoremute } = meta;
      if(this.muted && !ignoremute){ return }
      //Repeat if Message too long
      const limit = 320;
      const count = Math.ceil(message.length / limit);
      for (let i = 0; i < count; i++)
      this.client.chat({
        msg: message.substr(i * limit, limit),
        meta: Object.assign({}, this.useflair && this.rank <= 2 ? {
          modflair: this.rank
        } : {})
      });
    },
    pollAction(poll, callback) {
      return new Promise((resolve, reject) => {
        if (!this.meeseeks('pollctl')) {
          return this.sendMessage('I lack this capability due to channel permission settings.')
        }
        if (callback && typeof callback  === 'function') resolve = callback
        this.client.createPoll(poll)
        this.client.once('newPoll', () => {
          let timeout = false
          if (poll.timeout && poll.timeout > 10) {
            timeout = setTimeout(() => {
              this.sendMessage('Noch 10 Sekunden Zeit abzustimmen.', { ignoremute: true })
            }, (poll.timeout - 10) * 1000)
          }
          this.client.once('closePoll', () => {
            timeout && clearTimeout(timeout)
            resolve(this.poll.counts)
          })
        })
      })
    },
    addLastImage(image) {
      return new Promise((resolve, reject) => {
        if (image === this.lastImages[0]) return resolve(image)
        this.lastImages.unshift(image)
        this.db.knex('lastimage').insert({ image }).then(() => {
          //ponk.logger.log('Image posted: ' + image)
          resolve(image)
        }, error => {
          this.logger.error('Unexpected error', '\n', error);
          resolve(image)
        })
      })
    },
    getLastImage(back) {
      if (!back) back = 0
      return new Promise(resolve => {
        if (this.lastImages.length > back + 1) return resolve(this.lastImages[back])
        this.db.knex('lastimage')
        .select('image').limit(back + 1).orderBy('id', 'desc').then(result => {
          if (result.length > back) {
            this.lastImages = result.map(row => row.image)
            resolve(this.lastImages[back])
          }
        }, err => resolve(this.sendMessage('fehler')))
      })
    },
    sendByFilter(message, force) {
      if (!this.meeseeks('filteredit')) {
        if (force) return this.sendMessage('Für diese Funktion muss ich Filter erstellen dürfen')
        return this.sendMessage(message)
      }
      if (message.length < 320 && !force) return this.sendMessage(message)
      const limit = 1000
      const count = Math.ceil(message.length / limit)
      for (let i = 0; i < count; i++) {
        const name = 'Bot filter ###' + Math.random().toString(36).slice(2) + '###'
        this.client.socket.emit('addFilter', {
          name,
          source: name,
          replace: message.substr(i * limit, limit),
          flags: '',
          active: true
        })
      }
    }
  })
  ponk.client.on('updateChatFilter', ({ name }) => {
    if (!name.startsWith('Bot filter ###')) return
    ponk.sendMessage(name)
    setTimeout(() => ponk.client.socket.emit('removeFilter', {
      name
    }), 2000)
  })
  ponk.client.socket.emit('requestChatFilters')
  ponk.logger.log(`Requested Chat-Filters`)
  if (!ponk.server) {
    const { weblink, webport } = require('../config.js').webhost
    ponk.server = {
      host: require('express')(),
      weblink,
      webport
    }
    ponk.server.host.listen(webport)
  }
  if (!process.env.PORT) ponk.server.weblink += ':' + ponk.server.webport
  ponk.db.createTableIfNotExists('lastimage', (table) => {
    table.increments();
    table.string('image', 480)
  })
  ponk.client.on('channelOpts', opts => {
    if (!opts.show_public) return
    ponk.client.once('readChanLog', ({ data }) => {
      ponk.client.sendOptions({ show_public: false })
      ponk.client.createPoll({
        title: `${(data.trim().split('\n').pop().match(/\[mod\] (\w+)/) || [])[1]} ist der huso`,
        opts: ['/gas', '/hinaus', '/pissdich', '/2homo', '/fdax'],
        obscured: false
      })
    })
    ponk.client.socket.emit('readChanLog')
  })
}
