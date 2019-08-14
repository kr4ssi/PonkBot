/*!
**|   PonkBot auto-add
**@
*/

'use strict';

const Watcher = require('rss-watcher')

class autoAdd {
  constructor(ponk){
    Object.assign(this, {
      bot         : ponk   // The bot
    })
    const watcher = new Watcher('https://www.youtube.com/feeds/videos.xml?channel_id=UCNqljVvVXoMv9T7dPTvg0JA')
    watcher.on('new article', article => {
      this.bot.db.getKeyValue('newfeed').then(newfeed => {
        //console.log(newfeed, article, article.link, article.title)
        if (article.link === newfeed) return
        this.bot.sendMessage(article.title + ' addiert')
        this.bot.API.add.add(article.link, undefined, {fiku: true})
        this.bot.db.setKeyValue('newfeed', article.link)
      })
    }).on('error', err => {
      console.error(err)
    }).run((err, articles) => {
      if (err) return console.error(err)
      articles.forEach(article => {
        //console.log(article)
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
      ponk.API.autoadd = new autoAdd(ponk);
      ponk.logger.log('Registering auto-add');
      resolve();
    })
  },
  handlers: {
    //autoadd: function(user, params, meta) {

    //}
  }
}
