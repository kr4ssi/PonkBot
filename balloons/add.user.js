console.log('Userscript loaded', new class UserScript {
  constructor(url) {
    const match = window.location.hash.match(/#userscript(\d+)/)
    Object.assign(this, {
      active: !!match
    }, config, includes.find(include => {
      return !!(this.match = url.match(include.regex))
    }))
    if (typeof this.init != 'function') throw new Error('No constructor found')
    if (!this.active) return
    let initTimer
    initTimer = setInterval(() => {
      if (this.init() != false) clearInterval(initTimer)
      if (!this.fileurl) return
      if (this.postMessage && window.parent) return window.parent.postMessage({
        userlink: this.fileurl
      }, 'https://cytu.be/r/' + this.chan)
      if (this.useGetValue) return GM_setValue(this.url, this.fileurl)
      if (this.doAsk && !confirm(`Userlink:\n${this.fileurl}\n
        für Addierungslink: ${this.url}\ngefunden. Dem Bot schicken?`)) return
      window.location.replace(`${this.weblink}/add.json?${new URLSearchParams({
        url: match[1],
        userlink: this.fileurl
      }).toString()}`)
    }, 1000)
  }
  get url() {
    return this.match[0]
  }
}(window.location.href))
