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
  ponk.client.socket.on('newPoll',            (poll)=>{ ponk.handleNewPoll(poll) });
  ponk.client.socket.on('updatePoll',         (poll)=>{ ponk.handleUpdatePoll(poll) });
  ponk.client.socket.on('closePoll',              ()=>{ ponk.handleClosePoll() });
  ponk.client.socket.on('channelCSSJS',      (cssjs)=>{ ponk.handleChannelCSSJS(cssjs) });
  ponk.client.socket.on('setMotd',            (motd)=>{ ponk.handleMotd(motd) });
  ponk.client.socket.on('chatFilters',     (filters)=>{ ponk.handleChatFilters(filters) });
  ponk.client.socket.on('updateChatFilter', (filter)=>{ ponk.handleFilterUpdate(filter) });
  ponk.client.socket.on('deleteChatFilter', (filter)=>{ ponk.handleFilterRemove(filter) });
  Object.assign(ponk, {
    pollactive      : false, // Is a poll running?
    poll            : {},    // The current running, or last active poll
    channelCSSJS    : {},    // The channel CSS and JS { css: <String>, js: <String> }
    channelMotd     : '',    // The channel Motd
    chatFilters     : [],    // A list of chat-filtes
    gotEmoteList    : false,
    gotChannelCSSJS : false,
    gotChannelMotd  : false,
    gotChatFilters  : false,
    lastImages      : [],    // A list with lastly posted Images
    handleEmoteList: function(list) {
      this.emotes = list;
      this.gotEmoteList = true
      this.logger.log(`Recieved emotelist.`);
    },
    // { counts: [], initiator: <String>, options: [], timestamp: <Int>, title: <String> }
    handleNewPoll: function(poll) {
      this.logger.log(`Opened Poll`);
      this.pollactive = true;
      this.poll = poll;
    },
    // { counts: [], initiator: <String>, options: [], timestamp: <Int>, title: <String> }
    handleUpdatePoll: function(poll) {
      this.poll = poll;
      this.logger.log(`Updated Poll`);
    },
    handleClosePoll: function() {
      this.pollactive = false;
      this.logger.log(`Closed Poll`);
    },
    // { css: <String>, cssHash: <String>, js: <String>, jsHash: <String> }
    handleChannelCSSJS: function(cssjs) {
      this.channelCSS = cssjs.css
      this.channelJS = cssjs.js
      this.channelCSSJS = cssjs
      this.gotChannelCSSJS = true
      this.logger.log(`Updated Channel-JS/CSS`)
    },
    // <String>
    handleMotd: function(motd) {
      this.channelMotd = motd
      this.gotChannelMotd = true
      this.logger.log(`Updated Channel-Motd`)
    },
    // [ { name: <String>, source: <String>, replace: <String>, flags: <String>, active: <Boolean>, filterlinks: <Boolean> }, ... ]
    handleChatFilters: function(filters) {
      this.chatFilters = filters
      this.gotChatFilters = true
      this.logger.log(`Received Chat-Filters`)
    },
    // { name: <String>, source: <String>, replace: <String>, flags: <String>, active: <Boolean>, filterlinks: <Boolean> }
    handleFilterUpdate: function(filter){
      let found = false;
      for(const old of this.chatFilters){
        if(old.name !== filter.name){ continue }
        this.chatFilters.splice(this.chatFilters.indexOf(old), 1, filter);
        const changes = Object.keys(filter).reduce((changes, key) => {
          if (old[key] != filter[key]) changes[key] = filter[key]
          return changes
        }, {});
        this.logger.log(`Filter "${filter.name}" updated: ${JSON.stringify(changes)}`);
        found = true;
        break;
      }
      if(!found){
        this.chatFilters.push(filter);
        this.logger.log(`Filter "${filter.name}" added.`);;
      }
    },
    // { name: <String>, source: <String>, replace: <String>, flags: <String>, active: <Boolean>, filterlinks: <Boolean> }
    handleFilterRemove: function({ name }){
      for(const filter of this.chatFilters){
        if(filter.name !== name){ continue }
        this.chatFilters.splice(this.chatFilters.indexOf(filter), 1);
        this.logger.log(`Filter "${name}" removed.`);
        break;
      }
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
  ponk.client.socket.on('announcement',         data => console.log('announcement', data))
  ponk.client.socket.on('cancelNeedPassword',   data => console.log('cancelNeedPassword', data))
  ponk.client.socket.on('channelNotRegistered', data => console.log('channelNotRegistered', data))
  ponk.client.socket.on('channelRankFail',      data => console.log('channelRankFail', data))
  ponk.client.socket.on('channelRanks',         data => console.log('channelRanks', data))
  ponk.client.socket.on('clearFlag',            data => console.log('clearFlag', data))
  ponk.client.socket.on('clearVoteskipVote',    data => console.log('clearVoteskipVote', data))
  ponk.client.socket.on('cooldown',             data => console.log('cooldown', data))
  ponk.client.socket.on('empty',                data => console.log('empty', data))
  ponk.client.socket.on('errorMsg',             data => console.log('errorMsg', data))
  ponk.client.socket.on('kick',                 data => console.log('kick', data))
  ponk.client.socket.on('loadFail',             data => console.log('loadFail', data))
  ponk.client.socket.on('needPassword',         data => console.log('needPassword', data))
  ponk.client.socket.on('noflood',              data => console.log('noflood', data))
  ponk.client.socket.on('pm',                   data => console.log('pm', data)) // {msg: '', meta: {}, time: 0, to: ''}
  ponk.client.socket.on('searchResults',        data => console.log('searchResults', data))
  ponk.client.socket.on('setFlag',              data => console.log('setFlag', data))
  ponk.client.socket.on('spamFiltered',         data => console.log('spamFiltered', data))
  ponk.client.socket.on('validationError',      data => console.log('validationError', data))
  ponk.client.socket.on('validationPassed',     data => console.log('validationPassed', data))
  //ponk.client.socket.on('voteskip',             data => console.log('voteskip', data))
  ponk.client.socket.on('warnLargeChandump',    data => console.log('warnLargeChandump', data))
  ponk.client.socket.on('readChanLog',          data => console.log('readChanLog', data))
  //ponk.client.socket.on('addFilterSuccess',     data => console.log('addFilterSuccess', data))
}
