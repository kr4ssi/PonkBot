/*!
**|   PonkBot
**|   A chat bot for CyTube
**|
**@author    Xaekai
**@copyright 2017
**@license   MIT
*/

'use strict';

if (require('fs').existsSync('./.env')) require('dotenv').config();

const PonkBot = require('./lib/ponkbot.js');
const config = require('./config')

var bot = new PonkBot(config);
