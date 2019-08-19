// ==UserScript==
// @name openload fürn KS
// @namespace https://github.com/kr4ssi/PonkBot/
// @version 1.0.7
// @author kr4ssi
// ==/UserScript==

const allowedHosts = [{regex: /./}]

const config = {}

const matchLinkRegEx = new RegExp('^' + (config.weblink + '/add.json?userscript&url=').replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&') + '(.*)')

const matchInclude = (allowedHosts.find(host => host.regex.test(window.location.href)) || {
  getInfo: () => {
    const socket = unsafeWindow.socket
    if (!socket) return
    if (typeof socket.on !== 'function') return
    clearInterval(initTimer)
    let srcTimer
    socket.on('changeMedia', ({ id }) => {
      clearInterval(srcTimer)
      const match = id.match(matchLinkRegEx)
      if (!match) return
      const url = match[1]
      if (!allowedHosts.find(host => host.regex.test(url))) return
      console.log(match)
      srcTimer = setInterval(() => {
        const e = document.getElementById('ytapiplayer_html5_api')
        console.log(e)
        if (!e) return
        clearInterval(srcTimer)
        e.src = GM_getValue(url)
      }, 1000)
    })
  }
}).getInfo

const initTimer = setInterval(() => {
  if (typeof matchInclude === 'function' && !matchInclude()) return
  clearInterval(initTimer)
  const confirmString = `Userlink:\n${link}\n\nfür Addierungslink:\n${window.location.href}\ngefunden. Dem Bot schicken?`
  console.log(link)
  if (config.useSendMessage && window.parent) return window.parent.postMessage({userlink: link}, 'https://cytu.be/r/' + config.chan)
  if (config.useGetValue) return GM_setValue(window.location.href, link)
  if (!config.dontAsk && !confirm(confirmString)) return
  window.location.replace(config.weblink + `/add.json?url=${window.location.href}&userlink=${link}`)
}, 1000)

let link = `${window.location.protocol}//${window.location.hostname}`
