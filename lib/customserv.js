/*!
**|   PonkBot Custon Server
**@
*/

'use strict';

const express = require('express')
const crypto = require('crypto')
const forwarded = require('forwarded')
const validUrl = require('valid-url')

const md5ip = req => crypto.createHash('md5').update(forwarded(req).pop()).digest('hex')

class PonkServer {
  constructor(config, logger, bot){

    Object.assign(this, config, { bot: bot });

    if (!process.env.PORT) this.weblink += ':' + this.webport

    const name = '/' + this.bot.name.toLowerCase()
    const trigger = this.bot.emotes.find(emote => emote.name === name)
    if (!/localhost/.test(this.weblink) && (!trigger || trigger.image != this.weblink)) this.bot.client.socket.emit('updateEmote', { name, image: this.weblink })

    if(!logger){ throw new Error('Logger not provided') }
    this.logger = {
      log: (...line)=>{
        logger.emit('bot', '[PonkServ]', ...line);
      },
      error: (...line)=>{
        logger.emit('err', '[PonkServ]', ...line);
      },
      debug: (...line)=>{
        if(this.debug){
          logger.emit('debug', '[PonkServ]', ...line);
        }
      },
    }

    this.logger.log('Creating webhost.')
    this.host = express()

    this.host.get('/', (req, res) => {
      var img = new Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAA' +
      'AAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': img.length
      });
      res.end(img);
    })

    this.host.get('/emotes.json', (req, res) => {
      res.json(bot.emotes.map(emote => ({name: emote.name, image: emote.image})));
    });

    const fixurl = url => {
      if (typeof url === 'undefined') return false;
      url = decodeURIComponent(url).replace(/^http:\/\//i, 'https://');
      url = validUrl.isHttpsUri(url);
      if (!url) return false;
      url = url.replace(/https:\/\/(openload.co|oload\.[a-z0-9-]{2,})\/(f|embed)\//, 'https://openload.co/f/');
      return url.replace(/https:\/\/(streamango\.com|fruithosts\.net)\/(f|embed)\//, 'https://streamango.com/f/');
    }

    const userlink = (req, res) => {
      const url = fixurl(req.query.url);
      if (!url) return res.send('invalid url');
      if (!req.query.userlink) return res.send('invalid userlink');
      if (!this.bot.userLinks[url]) this.bot.userLinks[url] = {};
      this.bot.userLinks[url][md5ip(req)] = req.query.userlink;
      res.send('added');
    }

    this.host.get('/userlink', userlink);

    this.host.get('/add.json', (req, res) => {
      if (req.query.userlink) return userlink(req, res);
      const url = fixurl(req.query.url)
      if (!url) return res.send('invalid url');
      const cmManifest = this.bot.cmManifests[url];
      if (!cmManifest) return res.json({title: 'no manifest found'});
      res.json(cmManifest.manifest);
    });

    this.host.get('/redir', (req, res) => {
      const empty = 'https://ia801501.us.archive.org/0/items/youtube-yUUjeindT5U/VHS_simple_static_noise_-_Motion_background_loop_1-yUUjeindT5U.mp4';
      const url = fixurl(req.query.url);
      if (!url) return res.redirect(empty);
      const userLinks = this.bot.userLinks[url];
      if (userLinks && userLinks[md5ip(req)]) res.redirect(userLinks[md5ip(req)]);
      else res.redirect(empty);
    });

    this.host.get('/ks.user.js', (req, res) => {
      res.end(require('fs').readFileSync('ks.user.js', {encoding: "utf-8"}).replace('https://synchapi.herokuapp.com', config.weblink));
    })

    this.host.get('/ks.dontask.user.js', (req, res) => {
      res.end(require('fs').readFileSync('ks.user.js', {encoding: "utf-8"}).replace('https://synchapi.herokuapp.com', config.weblink).replace('if (confirm', '//$1'));
    })

    this.logger.log('Listening.');
    this.host.listen(config.webport);

    process.on('SIGTERM', () => {
      bot.sendMessage(config.weblink + '?' + Math.random().toString(36).slice(2) + '.pic');
    });
  }
}
module.exports = PonkServer;
