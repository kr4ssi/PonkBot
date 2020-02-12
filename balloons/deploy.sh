#!/bin/bash
cd $(dirname $(dirname $0))
git pull
git clone https://github.com/ytdl-org/youtube-dl.git
npm install
cd youtube-dl
git pull
pm2 restart ksbot
