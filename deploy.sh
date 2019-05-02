#!/bin/bash
cd $(dirname $0)
git pull
./bin/youtube-dl -U  --restrict-filenames
pm2 restart ksbot
