/*!
**|   PonkBot Helpdatas
**@
*/

'use strict'

module.exports = {
  mute: {
    synop: 'Mutet einen Nutzer mit .mute Nutzername. Es erscheint ein Muteknopf neben dem Nutzer in der Userübersicht. Legenden besagen, dass dieser Befehl nicht benutzt werden muss, wenn man sich benimmt',
    rank: 4
  },
  unmute: {
    synop: 'Macht die Stummschaltung eines Nutzers rückgängig mit .unmute Nutername, sodass dieser wieder reden darf. Dieser Befehl darf nur benutzt werden, wenn derjenige ungerechtfertigt gemutet wurde, oder wenn man lange genug auf der stillen Treppe war',
    rank: 4
  },
  poll: {
    synop: 'Startet einen Poll. Dazu bitte .poll Fragestellung; Antwort 1; Antwort 2; ... usw schreiben. Alle Mötter dürfen einen Poll erstellen, es sollte aber vorher geguckt werden, ob gerade bereits ein wichtiger Poll läuft (z.B. Fikupoll)',
    rank: 2
  },
  endpoll: {
    synop: 'Beendet den Poll',
    rank: 4
  },
  kick: {
    synop: 'Ein lästiger Nutzer wird gekickt mit .kick Nutzername',
    rank: 4
  },
  ban: {
    synop: 'Bannt einen Nutzer mit .ban Nutername. Eine Bannentscheidung sollte vorher mit anderen anwesenden Motts abgesprochen werden',
    rank: 4
  },
  ipban: {
    synop: 'IP-Bannt einen Nutzer mit .ipban Nutername. IP-gebannte Nutzer sollten nicht mit anderen Accounts den Bann umgehen können. Eine Bannentscheidung sollte vorher mit anderen anwesenden Motts abgesprochen werden',
    rank: 4
  },
  unban: {
    synop: 'Entbannt einen Nutzer mit .unban Nutername. Eine Entbannentscheidung sollte vorher mit anderen anwesenden Motts abgesprochen werden',
    rank: 4
  },
  skip: {
    synop: 'Skippt das gerade gezeigte Video. Streams und Krebs kann man schon mal skibben',
    rank: 4
  },
  skiplock: {
    synop: 'Macht die Säge aus',
    rank: 4
  },
  flood: {
    synop: 'Aktiviert oder deaktiviert den Chat Throttle, was auch immer das sein mag',
    rank: 4
  },
  shuffle: {
    synop: 'Ein besonders lästiger Befehl, der die Liste mischt und zu viel Mett führt',
    rank: 4
  },
  gettime: {
    synop: 'Wirft den Zeitcode für das aktuell gezeigte Video aus',
    rank: 0
  },
  settime: {
    synop: 'Setzt das Video auf eine gewählte Stelle. Beispiel: .settime 1:30 -> das Video springt auf 1 Minute 30 Sekunden, .settime 1:30:00 -> das Video springt auf 1 Stunde 30 Minuten .settime + X und - X verschiebt die aktuelle Stelle um X Stunden/Minuten/Sekunden',
    rank: 4
  },
  addrandom: {
    synop: 'Fügt ein zufälliges kürzeres Video, das schonmal gezeigt wurde, der Liste hinzu',
    rank: 2
  },
  zen: {
    synop: 'Spuckt ein hilfreiches Zitat aus der Glaubensstruktur des Zen-Buddhismus aus',
    rank: 0
  },
  stoll : {
    synop: 'Spuckt ein lehrreiches Zitat von Dr. Axel Stoll, promovierter Naturwissenschaftler, aus',
    rank: 0
  },
  hitler: {
    synop: 'Spuckt ein judenkritisches Zitat von Adolf Hitler, Reichskanzler des deutschen Reichs 1933-1945, aus',
    rank: 0
  },
  breifick: {
    synop: 'Spuckt ein islamkritisches Zitat aus dem Manifest von Anders Behring Breivik, norwegischer Massenmörder, aus',
    rank: 0
  },
  ratschlag: {
    synop: 'Spuckt einen zufällig zusammengewürfelten Ratschlag oder Bauernweisheit aus',
    rank: 0
  },
  fut: {
    synop: 'Spuckt ein zufälliges, fut-relatiertes Wort aus',
    rank: 0
  },
  frage: {
    synop: 'Beantwortet eine formulierte Frage mit ja, nein, vielleicht oder einer schnippischen Antwort des Bots',
    rank: 0
  },
  armbernd: {
    synop: 'Generiert ein zufälliges armberndemote. Legenden besagen, dass derjenige, der drei gleiche Emotes in einem Post kriegt, ein GF bekommt',
    rank: 0
  },
  saufen: {
    synop: 'Wählt einen aktiven Nutzer aus und fordert ihn auf, seine Kehle mit einem alkoholischen Getränk zu benetzen',
    rank: 0
  },
  tourette: {
    synop: 'Generiert eine zufällige Antwort im Stile eines Tourette-Patienten',
    rank: 0
  },
  pizza: {
    synop: 'Stellt einen Wecker für X Minuten mit .pizza X. Nach Ablauf der Zeit erhält der Nutzer eine PN vom Bot',
    rank: 0
  },
  oder: {
    synop: 'Wählt einen zufällige Antwort aus. Zum Benutzen bitte .oder Antwort 1; Antwort 2; ... usw. schreiben',
    rank: 0
  },
  aufräumen: {
    synop: 'Löscht alle Videos eines Nutzers mit .aufräumen Nutzername, nachdem die Mehrheit der Nutzer dafür gestimmt hat. Legenden besagen, dass das Abbrechen von Polls gegen sich selbst ein frevelhaftes Verbrechen darstellt',
    rank: 0
  },
  giphy: {
    synop: 'Zeigt ein Gif von giphy.com je nach Suchwort. Beispiel .giphy Vulva. Nur .giphy zeigt ein zufälliges Gif',
    rank: 0
  },
  tenor: {
    synop: 'Zeigt ein Gif von tenor.com je nach Suchwort. Beispiel .giphy Penis. Nur .tenor zeigt ein zufälliges Gif',
    rank: 0
  },
  w0bm: {
    synop: 'Zeigt ein webm von w0bm.com je nach Suchwort. Beispiel .w0bm Hitler. Nur .w0bm addiert das letzte gesuchte webm. .w0bm willkür willkürt ein zufälliges webm',
    rank: 0,
    repeat: true,
    addnext: 'willkür'
  },
  pr0: {
    synop: 'Zeigt ein Bild, Gif oder webm von pr0gramm.com je nach Suchwort. Beispiel .pr0 CNC-Bearbeitungszentrum. Nur .pr0 addiert das letzte gesuchte webm. .pr0 + video zeigt ein webm je nach Suchbegriff Beispiel: .pr0 Mulle video, .pr0 + willkür am Ende addiert ein zufälliges Video als nächstes. Beispiel: .pr0 willkür',
    rank: 0,
    repeat: true,
    addnext: 'willkür'
  },
  netzm: {
    synop: 'Addiert webms von Kohlchan. Auswählen eines Fadens mit .netzm Fadenelfe, Beispiel .netzm https://kohlchan.net/b/res/1234567.html. Nur .netzm addiert danach ein webm aus diesem Faden.',
    rank: 0,
    repeat: true,
    addnext: 'willkür'
  },
  lastimage: {
    synop: 'Zeigt das zuletzt verlinkte Bild, das kein Emote ist, nochmal',
    rank: 0
  },
  alle: {
    synop: 'Generiert eine Liste aller Nutzer im Chat und stupst sie an',
    rank: 0
  },
  userpoll: {
    synop: 'Startet einen Poll mit jedem aktiven Nutzer als Antwortmöglichkeit Beispiel: .userpoll Wer ist der dümmste Nutzer im Synch?',
    rank: 3
  },
  rüge: {
    synop: 'Startet einen Poll, um eine Rüge gegen einen Nutzer auszusprechen mit .rüge Nutzername. Nach positivem Ende des Polls wird der betroffene Nutzer offiziell gerügt',
    rank: 2
  },
  willkürpoll: {
    synop: 'Startet einen Poll mit allen Videos in der Liste außer permanenten Videos. Das Gewinnervideo wird gewillkürt',
    rank: 2
  },
  springpoll: {
    synop: 'Startet einen Poll mit allen Videos in der Liste außer permanenten Videos. Die Liste springt dann zu dem Gewinnervideo und läuft von da an weiter',
    rank: 3
  },
  mischenpoll: {
    synop: 'Startet einen Poll darüber ob die Liste gemischt werden soll',
    rank: 3
  },
  rehost: {
    synop: 'Rehostet ein Bild auf framapic.org mit .rehost Bildlink',
    rank: 2
  },
  addemote: {
    synop: 'Addiert das zuletzt gezeigte Bild als Emote mit .addemote Emotename',
    rank: 3
  },
  emote: {
    synop: 'Zeigt die Menge der Nutzung eines Emotes und den Nutzer, der es zuletzt benutzt hat mit .emote Emotename',
    rank: 0
  },
  emotesize: {
    synop: 'Verändert permanent die Größe von emotes per css',
    rank: 3
  },
  selbstsäge: {
    synop: 'löscht das neueste, eigene Video',
    rank: 0
  },
  help: {
    synop: 'Ruft eine Liste mit allen Befehlen auf',
    rank: 0
  },
  hintergrund: {
    synop: 'Ändert den Hintergrund. Beispiel .hintergrund https://i.imgur.com/yHdk5x9.jpg Kann nur https-Adressen nutzen',
    rank: 4
  },
  logo: {
    synop: 'Ändert das Logo. Beispiel .logo https://i.imgur.com/DaHiV3E.jpg Kann nur https-Adressen nutzen',
    rank: 3
  },
  add: {
    synop: 'Addiert ein Video, das nicht normal addiert werden kann. Addierbare Hosts: ',
    rank: 1,
    addnext: 'willkür'
  },
  readd: {
    synop: 'Addiert einen anderen Link für den gerade laufenden Film. Beispiel: es läuft ein Film von einem Hoster der stockt: .readd Elfe des Alternativströms ersetzt den laufenden Film und spult automatisch vor',
    rank: 3,
  },
  lauer: {
    synop: 'Zeigt einen Kohlchanpost im Chat an. Beispiel: .lauer https://kohlchan.net/tu/res/536.html',
    rank: 0
  },
  wiki: {
    synop: 'Zeigt einen Wikipediaeintrag je nach Suchwort an. Manche Suchwörter haben allerdings keinen Wikipediaeintrag z.B. .wiki Holocaustlüge',
    rank: 0
  },
  pic: {
    synop: 'Zeigt eine Instagram-Direktelfe',
    rank: 0
  },
  anagramde: {
    synop: 'Erstellt ein Anagram aus einem deutschen Suchwort. Beispiel .anagramde Lauerstein = Salutieren ',
    rank: 0
  },
  fikupoll: {
    synop: 'Erstellt den Fikupoll. Beenden des Fikupolls addiert den Film, wenn er mit .fikuadd addierbar ist, oder startet eine Stichwahl bei Gleichstand',
    rank: 3
  },
  ausschussfiku: {
    synop: 'Macht einen Fikupoll mit einer Auswahl der älteren Filme. Kann man mal machen wenn nix in der Liste ist um die alten Filme laufen zu lassen',
    rank: 3
  },
  vorschlag: {
    synop: 'Addiert einen Film zur Fikuliste mit .vorschlag NAME; ELFE. Bitte prüft Verfügbarkeit und Qualität des Films vor dem Addieren, um einen reibungslosen Fiku zu gewährleisten :);)',
    rank: 2
  },
  fikuliste: {
    synop: 'Zeigt die Fikuliste und die Film-IDs der Filme',
    rank: 0
  },
  fikulöschen: {
    synop: 'Löscht einen Film von der Fikuliste mit .fikulöschen Film-ID',
    rank: 3
  },
  fikuaktiv: {
    synop: 'Stellt einen Film auf inaktiv oder aktiv, z.B. wenn die Elfe dood ist, dann taucht der Film nicht in dem Fikupoll auf',
    rank: 3
  },
  fikuändern: {
    synop: 'Ändert die Fikuelfe',
    rank: 2
  },
  fikuadd: {
    synop: 'Addiert den Film wenn er mit .add addierbar ist als nächstes mit .fikuadd Film-ID',
    rank: 1
  },
  fikuelfe: {
    synop: 'Zeigt die Elfe des Films mit .fikuelfe Film-ID',
    rank: 0
  },
  fikuinfo: {
    synop: 'Zeigt Cover, Beschreibung, Mitwirkende und imdb-Wertung des Films mit .fikuinfo Film-ID',
    rank: 0
  },
  trailer: {
    synop: 'Addiert einen Trailer des Films mit .trailer Film-ID. Manche Filmbeschreibungen finden ggf. keinen Trailer z.B. Franz Eder - Exzesse Im Fitnesscenter',
    rank: 0
  },
  dice: {
    synop: 'Führt einen einfachen Rechenbefehl aus mit +, -, *, /',
    rank: 0
  },
  '8ball': {
    synop: 'Sagt einem die Zukunft auf Englisch vorraus',
    rank: 0
  },
  randomuser: {
    synop: 'Wählt einen zufälligen aktiven Nutzer aus',
    rank: 0
  },
  choose: {
    synop: 'Wählt einen zufällige Antwort aus. Zum Benutzen bitte .choose Antwort 1 Antwort 2 ... usw. (ohne Semikolon) schreiben',
    rank: 0
  },
  ask: {
    synop: 'Beantwortet eine formulierte Frage mit ja oder nein, ohne die Möglichkeit eine schnippische Antwort vom Bot zu bekommen',
    rank: 0
  },
  anagram: {
    synop: 'Erstellt ein Anagram aus einem englischen Suchwort. Beispiel: .anagram When a curious hate oozes calamity = What you choose can materialize us',
    rank: 0
  },
  waskochen: {
    synop: 'Gibt einem einen Tipp was man kochen könnte',
    rank: 0
  },
  wetter: {
    synop: 'Zeigt einem den Wetterbericht für die aktuelle Zeit für einen Standort. Beispiel: .wetter Altschauerberg',
    rank: 0
  },
  urban: {
    synop: 'Erklärt einen umgangsprachlichen Begriff Beispiel: .urban Dirty Sanchez',
    rank: 1
  },
  dict: {
    synop: 'ist kaputt /tja',
    rank: 1
  },
  inspire: {
    synop: 'Zeigt einem ein hilfreiches Motivationsbild und Spruch',
    rank: 1
  },
  liveleak: {
    synop: 'addiert was von Liveleak. .liveleak willkür addiert etwas als Nächstes',
    rank: 0,
    repeat: true,
    addnext: 'willkür'
  },
  mutter: {
    synop: 'Generiert einen zufälligen "Deine-Mutter-Witz", um eine enge Debatte letztendlich für sich zu entscheiden',
    rank: 0
  },
  mützen: {
    synop: '',
    rank: 4
  },
  getemote: {
    synop: '',
    rank: 4
  },
  tv: {
    synop: '',
    rank: 1
  },
  gez: {
    synop: '',
    rank: 2
  },
  doku: {
    synop: '',
    rank: 2,
    addnext: 'willkür'
  },
  update: {
    synop: 'Updatet den Bot. Nur für echte 1337 haxx0r',
    rank: 4
  },
  ts: {
    synop: '',
    rank: 2
  }
}
