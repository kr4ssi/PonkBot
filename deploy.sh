#!/bin/bash
cd $(dirname $0)
git pull
git submodule update
npm install
cd youtube-dl
make
pm2 restart ksbot
