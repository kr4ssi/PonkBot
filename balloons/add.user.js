new (class UserScript {
  constructor(url) {
    const include = includes.find(include => {
      return !!(this.match = url.match(include.regex))
    })
    Object.assign(this, include, { config })
    let initTimer
    if (include) {
      if (window.location.hash != '#userscript') return
      initTimer = setInterval(() => {
      if (typeof include.init != 'function') throw new Error('No constructor found')
      if (include.init.call(this) === false) return
      clearInterval(initTimer)
      console.log(this)
      if (!this.fileurl) return
      console.log(this.fileurl)
      const confirmString = `Userlink:\n${this.fileurl}\n\nfür Addierungslink:\n${this.url}\ngefunden. Dem Bot schicken?`
      if (config.useSendMessage && window.parent) return window.parent.postMessage({userlink: this.fileurl}, 'https://cytu.be/r/' + config.chan)
      if (config.useGetValue) return GM_setValue(this.url, this.fileurl)
      if (!config.dontAsk && !confirm(confirmString)) return
      window.location.replace(config.weblink + `/add.json?url=${this.url}&userlink=${this.fileurl}`)
    }, 1000)
  }
    else if (config.useGetValue) initTimer = setInterval(() => {
      const matchLinkRegEx = new RegExp('^' + (config.weblink + '/add.json?userscript&url=').replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&') + '(.*)')
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
        if (!includes.find(include => include.regex.test(url))) return
        console.log(match)
        srcTimer = setInterval(() => {
          const e = document.getElementById('ytapiplayer_html5_api')
          console.log(e)
          if (!e) return
          clearInterval(srcTimer)
          e.src = GM_getValue(url)
        }, 1000)
      })
    })
    else throw new Error('No Config for this included Page found')
  }
  get url() {
    return this.match[0]
  }
})(window.location.href)
