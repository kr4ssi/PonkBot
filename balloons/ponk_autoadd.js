/*!
**|   PonkBot auto-add
**@
*/

'use strict';

const RssFeedEmitter = require('rss-feed-emitter')

class AutoAdd {
  constructor(ponk){
    Object.assign(this, {
      bot      : ponk,     // The bot
    })
    this.bot.db.knex.schema.hasTable('watcher').then(exists => {
      if (!exists) return this.bot.db.knex.schema.createTable('watcher', table => {
        table.string('id', 24).primary()
        table.bigint('last').unsigned()
      }).then(() => this.bot.db.knex('watcher').insert([{ id: 'UCNqljVvVXoMv9T7dPTvg0JA' },
      { id: 'UCVtVOddS0ms54kntAYXIVGg' },
      { id: 'UC_EZd3lsmxudu3IQzpTzOgw' }]))
    }).then(() => this.bot.db.knex('watcher').select('id').then(async rows => {
      await new Promise(resolve => setInterval(resolve, 2000))
      const feeder = new RssFeedEmitter({
        userAgent: ponk.API.randAgent,
        skipFirstLoad: true
      }).on('error', err => {
        console.error(err)
      }).on('new-item', article => {
        const id = article['yt:channelid']['#']
        const videoid = article['yt:videoid']['#']
        this.bot.db.knex('watcher').where({ id }).select('last').then(last => {
          if (videoid === last) return
          this.bot.sendMessage(`${article.author}\n${article.image.url}.pic ${article.title} addiert`)
          this.bot.API.add.add(article.link, article.title, { fiku: true })
          this.bot.db.knex('watcher').where({ id }).update({ last: videoid })
        })
      })
      rows.forEach(({ id }) => feeder.add({
        url: 'https://www.youtube.com/feeds/videos.xml?channel_id=' + id,
        refresh: 300000
      }))
    }))
  }
}

module.exports = {
  meta: {
    active: true,
    type: 'giggle'
  },
  giggle(ponk){
    return new Promise((resolve, reject)=>{
      ponk.API.autoadd = new AutoAdd(ponk);
      ponk.logger.log('Registering auto-add');
      resolve();
    })
  },
  handlers: {
    //autoadd(user, params, meta) {

    //}
  }
}
