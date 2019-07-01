// ==UserScript==
// @name openload fürn KS
// @namespace https://github.com/kr4ssi/PonkBot/
// @version 1.0.7
// @author kr4ssi
// ==/UserScript==

const config = {}

const matchLinkRegEx = new RegExp('^' + (config.weblink + '/add.json?userscript&url=').replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&') + '(.*)')

const includesRegExArr = GM_info.script.includes.map(include => new RegExp(include.replace(/^\/(.*)\/$/, '$1')))

const matchInclude = {
  [GM_info.script.includes[0]]: () => {
    let e = document.querySelector("[id^=lqEH1]")
    if (!e) e = document.querySelector("[id^=streamur]")
    if (!e) e = document.querySelector("#mediaspace_wrapper > div:last-child > p:last-child")
    if (!e) e = document.querySelector("#main p:last-child")
    if (!e) return
    if (e.textContent.match(/(HERE IS THE LINK)|(enough for anybody)/)) return
    link += `/stream/${e.textContent}?mime=true`
    return true
  },
  [GM_info.script.includes[1]]: () => {
    const e = document.querySelector("[id^=mgvideo_html5_api]")
    if (!e) return
    link = e.src
    return true
  },
  [GM_info.script.includes[2]]: () => {
    const e = document.querySelector('video').lastElementChild || document.querySelector('video')
    if (!e) return
    link = e.src
    return true
  },
  [GM_info.script.includes[3]]: () => {
    const e = document.querySelector("[id^=videolink]")
    if (!e) return
    link += `/gettoken/${e.textContent}?mime=true`
    return true
  },
  [GM_info.script.includes[4]]: () => {
    const e = window.pData
    if (!e) return
    link = window.pData.sourcesCode[0].src
    return true
  },
  [GM_info.script.includes[5]]: () => {
    const socket = unsafeWindow.socket
    if (!socket) return
    if (typeof socket.on !== 'function') return
    clearInterval(initTimer)
    includesRegExArr.pop()
    let srcTimer
    socket.on('changeMedia', ({ id }) => {
      clearInterval(srcTimer)
      const match = id.match(matchLinkRegEx)
      if (!match) return
      const url = match[1]
      if (!includesRegExArr.find(include => include.test(url))) return
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
}[includesRegExArr.find(include => include.test(window.location.href))]

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
