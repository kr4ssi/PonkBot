// ==UserScript==
// @name openload fürn KS
// @namespace https://github.com/kr4ssi/PonkBot/
// @version 1.0.6
// @author kr4ssi
// @include /^https?:\/\/([-\w]+\.)*openload\.(?:co|io|link|pw)|oload\.(?:tv|stream|site|xyz|win|download|cloud|cc|icu|fun|club|info|press|pw|live|space|services)|oladblock\.(?:services|xyz|me)|openloed\.co\/.+/
// @include /^https?:\/\/([-\w]+\.)*streamango\.com\/.+/
// @include /^https?:\/\/([-\w]+\.)*rapidvideo\.com\/.+/
// @include /^https?:\/\/([-\w]+\.)*verystream\.com\/.+/
// ==/UserScript==

let useGetValue = false

let weblink = ''

let link = `${window.location.protocol}//${window.location.hostname}`

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
    const e = unsafeWindow.socket
    if (!e) return
    if (!typeof e.on === 'function') return
    clearInterval(timer)
    e.on('changeMedia', ({ id }) => {
      const e = document.getElementById('ytapiplayer_html5_api')
      if (!e) return
      const match = id.match(new RegExp('^' + (weblink + '/add.json?url=').replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&') + '(.*)'))
      console.log(match)
      if (!match) return
      const url = match[1]
      if (!url) return
      if (includesRegExArr.findIndex(include => include.test(url)) < 1) return
      setTimeout(() => e.src = GM_getValue(url), 1000)
      console.log(document.getElementById('ytapiplayer_html5_api'))
    })
  }
}[includesRegExArr.find(include => include.test(window.location.href))]

const timer = setInterval(() => {
  if (typeof matchInclude === 'function' && !matchInclude()) return
  clearInterval(timer)
  const confirmString = `Userlink:\n${link}\n\nfür Addierungslink:\n${window.location.href}\ngefunden. Dem Bot schicken?`
  console.log(link)
  if (useGetValue) return GM_setValue(window.location.href, link)
  if (!confirm(confirmString)) return
  window.location.replace(weblink + `/add.json?url=${window.location.href}&userlink=${link}`)
}, 1000)
