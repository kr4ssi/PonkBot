/*!
**|   PonkBot Custom Commands
**@
*/

'use strict';

const fs = require('fs')
const path = require('path')
const bodyParser = require("body-parser")
const crypto = require('crypto')
const { TeamSpeak } = require('ts3-nodejs-library')
const { execFile } = require('child_process')

const update = () => {
  execFile(path.join(__dirname, './deploy.sh'), {
    cwd: path.join(__dirname, '..')
  }, (err, stdout, stderr) => {
    if (err) return console.error(err)
    console.log(stdout)
    console.log(stderr)
  })
}

module.exports = {
  helpdata: require('./help.js'),
  meta: {
    active: true,
    type: 'giggle'
  },
  giggle(ponk) {
    return new Promise((resolve, reject) => {
      ponk.server.host.use(bodyParser.json({
        verify: (req, res, buf) => {
          req.rawBody = buf
        }
      })).post('/githook', (req, res) => {
        const sig = req.header('X-Hub-Signature')
        if (sig && sig.split('=')[1] === crypto.createHmac('sha1', process.env.githooksecret).update(req.rawBody).digest('hex')) {
          const commit = req.body.commits[0]
          ponk.sendByFilter(`Neuer commit: <a href="${commit.url}" target="_blank" rel="noopener noreferrer">${commit.message}</a>`, true);
          update()
        }
        res.end('OK');
      })
      ponk.logger.log('Registering custom handlers');
      Object.assign(module.exports.handlers, ...Object.entries(fs.readdirSync(path.join(__dirname, 'quotes')).reduce((quotes, file) => {
        file = path.join(__dirname, 'quotes', file)
        const parsed = path.parse(file)
        const content = ({
          '.js': () => require(file),
          '.txt': () => fs.readFileSync(file).toString().split('\n')
        }[parsed.ext] || (() => null))()
        return Object.assign(quotes, Array.isArray(content) && {
          [parsed.name]: content
        })
      }, {
        fut: [
          'Fut',
          'Doppelfut',
          'Labbrige Doppelfut',
          'Futschlecker',
          'Garstiger Futlappen'
        ],
        armbernd: [
          '/tarm',
          '/armmoderiert',
          '/armbernd',
          '/sarm',
          '/fritt'
        ],
        saufen: [
          '/lahey',
          '/stoss',
          '/saufi',
          '/saufen',
          '/wein',
          '/lüning',
          '/stollschluck',
          '/schluck',
          '/tschluck',
          '/tadler',
          '/schunkel',
          '/bebe',
          '/kirk'
        ]
      })).map(([command, quotes]) => {
        module.exports.helpdata[command] = module.exports.helpdata[command] || {
          synop: 'Zeigt ein Zitat',
          rank: 0
        }
        const quote = (arr = quotes) => arr[Math.floor(Math.random() * arr.length)]
        return {
          [command]: {
            frage(user, params, meta) {
              this.sendMessage(quote().replace(/\${randuser}/, quote(this.userlist).name))
            },
            armbernd(user, params, meta) {
              this.sendMessage(meta.message.match(/armbernd/g).map(() => quote()).join(' '))
            },
            saufen(user, params, meta) {
              const notafk = this.userlist.filter(user => {
                return !user.meta.afk && ![this.name, 'kr4ssi', 'hrss'].includes(user.name)
              })
              if (!notafk.length) return sendMessage('Keiner da zum saufen')
              const randuser = quote(notafk).name
              this.sendMessage(quote([
                `Ich sage: ${randuser} muss saufen.`,
                `${randuser} wurde aus allen zum saufen ausgewählt.`,
                `Heute wird sich totgesoffen, ${randuser}.`,
                `Verabschiede dich von deine Leber, ${randuser}.`,
                `${randuser}! Kanalisiere deinen inneren kr4ssi.`,
                `Lass den Rosé stehen ${randuser} und pack den Männerschnappes aus.`,
                `Mr. ${randuser}, lassen sie den Schnaps aus Ihnen sprechen.`
              ]) + ' ' + quote())
            },
            tourette(user, params, meta) {
              if (Math.random() < 0.7) return this.sendMessage(quote())
              const rah = ['RAH', 'BRU', 'WAH', 'PAM', 'GNA']
              const ah = ['A', 'H', 'G', 'W', 'R']
              const rand = (min, max) => Math.floor(Math.random() * (max - min)) + min
              this.sendMessage([...Array(rand(5, 11))].reduce(msg => {
                const pos = rand(0, rah.length)
                return msg.slice(0, pos) + quote(ah) + msg.slice(pos)
              }, [...Array(rand(3, 6))].map(() => quote(rah)).join('')))
            }
          }[command] || function (user, params, meta) {
            this.sendByFilter(quote())
          }
        }
      }))
      ponk.cleanban = []
      resolve()
    })
  },
  handlers: {
    pizza(user, params, meta) {
      if (!/^[1-9][0-9]?(\.[0-9]{1-3})?$/.test(params)) return this.sendMessage('Du musst eine Zeit unter 100 Minuten angeben /ööäähh')
      this.sendPrivate('Werde dich nach ' +  params + ' Minuten erinnern.', user)
      setTimeout(() => {
        this.sendPrivate('/alarm', user)
      }, params * 1000 * 60)
    },
    oder(user, params, meta) {
      const splitParams = params.split(';')
      if (splitParams.length < 2) return this.sendMessage('Zu wenig Parameter gegeben.', user)
      this.sendMessage('Ich habe entschieden: ' + splitParams[Math.floor(Math.random() * splitParams.length)].trim())
    },
    aufräumen(user, params, meta) {
      if (!/\w/.test(params)) return this.sendMessage('Es muss ein Nutzer spezifiziert werden.', user)
      if (this.cleanban.includes(user)) return this.sendMessage('Aufräumen ist für dich nicht mehr verfügbar.')
      let username = new RegExp('^' + params, 'i')
      const isinplaylist = this.playlist.find(item => item.temp && username.test(item.queueby))
      if (!isinplaylist) return this.sendMessage('Benutzer nicht in der Playlist.')
      username = isinplaylist.queueby
      this.pollAction({
        title: 'Sollen alle Videos von ' + username + ' aus der Liste entfernt werden?',
        timeout: 30,
        opts: ['Ja /krebs', 'Nein /top'],
        obscured: false
      }, pollvotes => {
        if (pollvotes[0] <= pollvotes[1]) return this.sendMessage('Es werden keine Videos entfernt /feelsok')
        this.sendMessage('Alle Videos von ' + username + ' werden entfernt /gas')
        //this.sendMessage('/clean ' + username, { ignoremute: true })
        this.playlist.forEach(item => {
          if (item.temp && item.queueby === username) this.mediaDelete(item.uid)
        })
        this.cleanban.push(user)
        setTimeout(() => {
          this.cleanban.splice(this.cleanban.indexOf(user), 1)
        }, 4 * 1000 * 60 * 60) //Cooldown
      })
    },
    lastimage(user, params, meta) {
      let backstr = 'Zuletzt'
      let back = 0
      if (params.match(/^[1-9]$/)) {
        back = Number(params)
        backstr = (back + 1) + '.-zuletzt'
      }
      this.getLastImage(back).then(image => {
        this.sendMessage(backstr + ' pfostiertes bild: ' + image + '.pic')
      })
    },
    alle(user, params, meta) {
      this.sendByFilter(this.userlist.map(user => user.name).sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'})).join(' '))
    },
    userpoll(user, params, meta){
      if(!this.meeseeks('pollctl')){
        return this.sendPrivate(`I lack this capability due to channel permission settings.`, user)
      }
      if (!/\w/.test(params)) return this.sendMessage('Und die Frage /fz')
      this.client.createPoll({
        title: params,
        opts: this.userlist.map(user => user.name).sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'})),
        obscured: false
      })
    },
    rüge(user, params, meta) {
      if (!/\w/.test(params)) return this.sendMessage('Wer soll gerügt werden /frage')
      this.pollAction({
        title: 'Soll über ' + params + ' eine öffentliche Rüge ausgesprochen werden?',
        //timeout: 0,
        opts: ['j', 'n'],
        obscured: false
      }, pollvotes => {
        if (pollvotes[0] > pollvotes[1]) this.sendMessage(params + ' erhält hiermit eine öffentliche Rüge durch den ' + this.client.chan)
      })
    },
    willkürpoll(user, params, meta){
      const playlist = this.playlist.filter(row => row.temp)
      if (playlist.length > 2) {
        this.pollAction({
          title: 'Was willküren',
          timeout: 30,
          opts: playlist.map(row => row.uid != this.currUID ? row.media.title : 'Garnichts'),
          obscured: false
        }, pollvotes => {
          this.mediaMove({from: playlist[pollvotes.indexOf(Math.max(...pollvotes))].uid})
        })
      }
    },
    springpoll(user, params, meta){
      const playlist = this.playlist.filter(row => row.temp)
      if (playlist.length > 0 && !playlist.find(item => item.uid == this.currUID)) {
        this.pollAction({
          title: 'Willkürüberspringen der permanenten Videos /ffz',
          timeout: 20,
          opts: ['j', 'n'],
          obscured: false
        }, pollvotes => {
          if (pollvotes[0] > pollvotes[1]) this.client.jump(playlist[0].uid)
          //else sendMessage('Wird nicht gewillkürt')
        })
      }
    },
    mischenpoll(user, params, meta){
      if(!this.meeseeks('playlistmove')){
        return this.sendPrivate(`I lack this capability due to channel permission settings.`, user)
      }
      const playlist = this.playlist.filter(row => row.temp && row.uid != this.currUID).map(row => row.uid)
      if (playlist.length > 2) {
        this.pollAction({
          title: 'Mischen /ffz',
          timeout: 20,
          opts: ['j', 'n'],
          obscured: false
        }, pollvotes => {
          if (pollvotes[0] > pollvotes[1] + 1) playlist.forEach((uid, i, uids) => {
            let afteruids = uids.filter(row => row != uid)
            if (i > 0) afteruids = [this.currUID, ...afteruids]
            if (i == uids.length - 1) afteruids.pop()
            setTimeout(() => {
              this.mediaMove({from: uid, after: afteruids[Math.floor(Math.random() * afteruids.length)]})
            }, i * 200)
            //else sendMessage((pollvotes[0] == pollvotes[1] + 1) : 'Müssen 2 meer sein' ? 'Es wird nicht gemischt')
          })
        })
      }
    },
    selbstsäge(user, params, meta) {
      const lastbyuser = this.playlist.filter(item => item.queueby === user && item.temp).pop()
      if (lastbyuser) this.mediaDelete(lastbyuser.uid)
    },
    ts(user, params, meta) {
      TeamSpeak.connect({
        host: process.env.ts_url,
        queryport: process.env.ts_query,
        protocol: 'ssh',
        serverport: process.env.ts_port,
        username: process.env.ts_user,
        password: process.env.ts_pass
      }).then(teamspeak => {
        teamspeak.clientList({ client_type: 0 }).then(clients => {
          const [notmuted, muted] = clients.reduce((clients, client) => {
            clients[client.inputMuted].push(client.nickname)
            return clients
          }, [[], []])
          this.sendMessage('Teamspeak: ' + process.env.ts_showurl + '\nBenutzer aktiv: ' +
          notmuted.join(', ') + '\nBenutzer stumm: ' + muted.join(', '))
          teamspeak.quit()
        })
      }).catch(error => {
        console.error(error)
        this.sendMessage('Teamspeak-server nicht erreichbar')
      })
    },
    update(user, params, meta) {
      update()
    },
    help(user, params, meta) {
      if (this.commands.helpdata.hasOwnProperty(params)) this.sendByFilter(this.commands.helpdata[params].synop +
        ((params === 'add' && this.API.add) ? this.API.add.allowedHostsString : '') +
        (this.commands.helpdata[params].rank > 1 ? '. Geht ab Level: ' + this.commands.helpdata[params].rank :
        (this.commands.helpdata[params].rank === 1 ? '. Geht nur für registrierte User' : '')))
        else this.sendByFilter('Verfügbare Befehle: ' + Object.keys(this.commands.handlers).join(', '))
      }
    }
  }
