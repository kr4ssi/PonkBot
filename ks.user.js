// ==UserScript==
// @name        openload fürn KS
// @namespace   https://github.com/kr4ssi/PonkBot/
// @version     1.0.6
// @author      kr4ssi
// @include     /https?:\/\/(?:www\.)?(openload.co|oload\.[a-z0-9-]{2,})\/(f|embed)\/[^/?#&]+/
// @include     /https?:\/\/(?:www\.)?(streamango\.com|fruithosts\.net)\/(f|embed)\/[^/?#&]+/
// @include     /https?:\/\/(?:www\.)?rapidvideo\.com\/v\/[^/?#&]+/
// @include     /https?:\/\/(?:www\.)?verystream\.com\/(stream|e)\/[^/?#&]+/
// ==/UserScript==

const timer = setInterval(() => {
  let link = `${window.location.protocol}//${window.location.hostname}`
  if (window.location.href.match(/https?:\/\/(?:www\.)?(openload.co|oload\.[a-z0-9-]{2,})\/(f|embed)\/[^/?#&]+/)) {
    let e = document.querySelector("[id^=lqEH1]")
    if (!e) e = document.querySelector("[id^=streamur]")
    if (!e) e = document.querySelector("#mediaspace_wrapper > div:last-child > p:last-child")
    if (!e) e = document.querySelector("#main p:last-child")
    if (!e) return
    if (e.textContent.match(/(HERE IS THE LINK)|(enough for anybody)/)) return
    link += `/stream/${e.textContent}?mime=true`
  }
  else if (window.location.href.match(/https?:\/\/(?:www\.)?(streamango\.com|fruithosts\.net)\/(f|embed)\/[^/?#&]+/)) {
    let e = document.querySelector("[id^=mgvideo_html5_api]")
    if (!e) return
    link = e.src
  }
  else if (window.location.href.match(/https?:\/\/(?:www\.)?verystream.com\/(e|stream)\/[^/?#&]+/)) {
    let e = document.querySelector("[id^=videolink]")
    if (!e) return
    link += `/gettoken/${e.textContent}?mime=true`
  }
  else if (window.location.href.match(/https?:\/\/(?:www\.)?rapidvideo\.com\/v\/[^/?#&]+/)) {
    let e = document.querySelector('video').lastElementChild || document.querySelector('video')
    if (!e) return
    link = e.src
  }
  clearInterval(timer)
  if (confirm(`Userlink:\n${link}\n\nfür Addierungslink:\n${window.location.href}\ngefunden. Dem Bot schicken?`))
  window.location.replace(`##WEBLINK##/add.json?url=${window.location.href}&userlink=${link}`)
}, 1000)
