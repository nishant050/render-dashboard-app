#!/usr/bin/env bash
set -euo pipefail

npm ci

python -m pip install --upgrade pip
pip install -r requirements.txt
pip install -r apps/DietPlan/requirements.txt

if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y --no-install-recommends ffmpeg
fi

npx puppeteer browsers install chrome --install-deps
if command -v apt-get >/dev/null 2>&1; then
  rm -rf /var/lib/apt/lists/*
fi
ffmpeg -version

node -e "const puppeteer = require('puppeteer'); console.log('Puppeteer Chrome:', puppeteer.executablePath());"
