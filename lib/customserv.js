/*!
**|   PonkBot Custon Server
**@
*/

'use strict';

const express = require('express')

class PonkServer {
  constructor(config, logger, bot){

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

    this.logger.log('Listening.')
    this.host.listen(config.webport);

    process.on('SIGTERM', () => {
      bot.sendMessage(config.weblink + '?' + Math.random().toString(36).slice(2) + '.pic');
    });
  }
}
module.exports = PonkServer;
