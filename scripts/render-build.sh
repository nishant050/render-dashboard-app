#!/usr/bin/env bash
set -euo pipefail

npm ci

python -m pip install --upgrade pip
pip install -r requirements.txt
pip install -r apps/DietPlan/requirements.txt

npx puppeteer browsers install chrome

if command -v ffmpeg >/dev/null 2>&1; then
  ffmpeg -version
else
  echo "ffmpeg is not installed in this environment; video download merging may be unavailable."
fi

node -e "const puppeteer = require('puppeteer'); console.log('Puppeteer Chrome:', puppeteer.executablePath());"
