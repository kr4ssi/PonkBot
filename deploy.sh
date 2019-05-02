#!/bin/bash
cd $(dirname $0)
git pull
./bin/youtube-dl -U
pm2 restart ksbot
