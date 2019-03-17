/*!
**|   PonkBot
**|   A chat bot for CyTube
**|
**@author    Xaekai
**@copyright 2017
**@license   MIT
*/

'use strict';

const PonkBot = require('./lib/ponkbot.js');
const config = require('./config')
const request = require('request')

var bot = new PonkBot(config);
