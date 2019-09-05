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

class PonkServer {
  constructor(config, logger, bot){

    Object.assign(this, config, { bot: bot });

    if (!process.env.PORT) this.weblink += ':' + this.webport;

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

    this.update = () =>  execFile('./deploy.sh', {
      cwd: path.join(__dirname, '..')
    }, (err, stdout, stderr) => {
      if (err) return console.error(err)
    });

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
      res.setHeader('Content-Type', 'text/css');
      res.send(this.bot.emoteCSS);
    });

    this.host.get('/emotes.json', (req, res) => {
      res.json(bot.emotes.map(emote => ({name: emote.name, image: emote.image})));
    });

    this.host.use(bodyParser.json({
      verify: (req, res, buf) => {
        req.rawBody = buf
      }
    })).post('/githook', (req, res) => {
      const sig = req.header('X-Hub-Signature')
      if (sig && sig.split('=')[1] === crypto.createHmac('sha1', process.env.githooksecret).update(req.rawBody).digest('hex')) {
        const commit = req.body.commits[0]
        this.bot.sendByFilter(`Neuer commit: <a href="${commit.url}" target="_blank" rel="noopener noreferrer">${commit.message}</a>`, true);
        this.update()
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
