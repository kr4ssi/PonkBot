/*!
**|   PonkBot Custon Server
**@
*/

'use strict';

const { execFile } = require('child_process');
const path = require('path');
const express = require('express');
const bodyParser = require("body-parser");
const crypto = require('crypto');
const forwarded = require('forwarded');
const validUrl = require('valid-url');
const date = require('date-and-time');

const md5ip = req => crypto.createHash('md5').update(forwarded(req).pop()).digest('hex');

class PonkServer {
  constructor(config, logger, bot){

    Object.assign(this, config, { bot: bot });

    if (!process.env.PORT) this.weblink += ':' + this.webport;

    const userscript = require('fs').readFileSync('ks.user.js', {encoding: "utf-8"}).replace('##WEBLINK##', this.weblink);

    const parseDate = userscriptts => date.format(new Date(parseInt(userscriptts)), 'DD.MM.YY');

    if (!/localhost/.test(this.weblink)) {
      //const name = '/' + this.bot.name.toLowerCase();
      //const trigger = this.bot.emotes.find(emote => emote.name === name);
      //if (!trigger || trigger.image != this.weblink) this.bot.client.socket.emit('updateEmote', { name, image: this.weblink });

      this.bot.db.getKeyValue('userscripthash').then(userscripthash => {
        const newuserscripthash = crypto.createHash('md5').update(userscript).digest('hex');
        if (userscripthash === newuserscripthash) return this.bot.db.getKeyValue('userscriptts').then(userscriptts => {
          this.userscriptdate = parseDate(userscriptts)
        });
        this.userscriptdate = parseDate(this.bot.started);
        this.bot.db.setKeyValue('userscriptts', this.bot.started);
        this.bot.db.setKeyValue('userscripthash', newuserscripthash);
      });
    }
    else this.userscriptdate = parseDate(this.bot.started);

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

    this.host.get('/emotes.css', (req, res) => {
      this.bot.db.knex('emotes').whereNotNull('width').orWhereNotNull('height').select('emote', 'width', 'height').then(sizes => {
        res.setHeader('Content-Type', 'text/css');
        res.send(sizes.map(size => {
          if (((size.width < 1) || (size.width === 100)) && (size.height < 1) && (size.height === 100)) return ''
          return '.channel-emote[title="' + size.emote + '"] {\r\n' +
          ((size.width > 0) && (size.width != 100) ? ('  max-width: ' + ((size.width < 999) ? (size.width + 'px') : '100%') + ' !important;\r\n') : '') +
          ((size.height > 0) && (size.height != 100) ? ('  max-height: ' + ((size.height < 999) ? (size.height + 'px') : '100%') + ' !important;\r\n') : '') +
          '}'
        }).join('\r\n'));
      });
    });

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
      if (!cmManifest) return res.sendStatus(404);
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
      res.end(userscript);
    })

    this.host.get('/ks.dontask.user.js', (req, res) => {
      res.end(userscript.replace('if (confirm', '//$&'));
    })

    this.host.use(bodyParser.json({
      verify: (req, res, buf) => {
        req.rawBody = buf
      }
    })).post('/githook', (req, res) => {
      const sig = req.header('X-Hub-Signature')
      if (sig && sig.split('=')[1] === crypto.createHmac('sha1', process.env.githooksecret).update(req.rawBody).digest('hex')) {
        const commit = req.body.commits[0]
        this.bot.sendByFilter(`Neuer commit "${commit.message}": ${commit.url} /magier`);
        execFile('./deploy.sh', {
          cwd: path.join(__dirname, '..')
        }, (err, stdout, stderr) => {
          if (err) return console.error(err)
        });
      }
      res.end('OK');
    });

    this.logger.log('Listening.');
    this.host.listen(config.webport);

    //process.on('SIGTERM', () => {
    //  bot.sendMessage(config.weblink + '?' + Math.random().toString(36).slice(2) + '.pic');
    //});
  }
}
module.exports = PonkServer;
