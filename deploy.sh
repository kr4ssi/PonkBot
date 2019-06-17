#!/bin/bash
cd $(dirname $0)
git pull
npm install
cd ../youtube-dl
git pull
cp bin/youtube-dl youtube-dl
pm2 restart ksbot
