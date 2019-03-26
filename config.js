/*!
**|   Example Configuration
**@
*/

'use strict';
const client = process.env.db_type
module.exports = {
  ponk: {
    useflair : false,
    peers    : ['OtherBot'],
    audience : ['de'],
    nodisk   : true
  },
  commands: {
    disabled  : ['vodka','taco'],
    trigger   : /^\$|^\.|^\!/,
    ignorelog : ['8ball'],
  },
  sync: {
    host : 'cytu.be',
    port : '443', secure: true,
    user : process.env.sync_user,
    auth : process.env.sync_auth,
    chan : process.env.sync_chan
  },
  db: {
    client     : client,
    connection : client === 'mysql' ? {
      host : process.env.db_host,
      user : process.env.db_user,
      password : process.env.db_pass,
      database : process.env.db_name
    }
    : (client === 'pg' ? require('pg-connection-string').parse(process.env.DATABASE_URL)
    : { filename: 'ponkbot.db' }),
  },
  webhost: {
    secret   : process.env.secret,
    weblink  : process.env.weblink,
    webport  : process.env.PORT || '24233',
    sockport : '22356',
  },
  api: {
    youtube      : process.env.api_youtube || 'MyYouTubeAPIkey',
    wolfram      : process.env.api_wolfram || 'MyWolframAPIkey',
    wunderground : process.env.api_wunderground || 'MyWUndergroundAPIkey',
    cleverbot    : process.env.api_cleverbot || 'MyCleverBotAPIkey',
    giphy        : process.env.api_giphy,
    omdb         : process.env.api_omdb,
    tmdb         : process.env.api_tmdb,
    gitlab       : process.env.api_gitlab,
    gitrepo      : process.env.gitrepo,
    imagehost    : process.env.imagehost
  }
}
