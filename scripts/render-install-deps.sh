#!/usr/bin/env bash
set -euo pipefail

echo "[render-install] Installing Node dependencies"
npm ci

echo "[render-install] Installing Python dependencies"
python -m pip install --upgrade pip
pip install -r requirements.txt

echo "[render-install] Ensuring ffmpeg exists"
if command -v ffmpeg >/dev/null 2>&1; then
  echo "[render-install] ffmpeg already present: $(command -v ffmpeg)"
elif command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y --no-install-recommends ffmpeg
  rm -rf /var/lib/apt/lists/*
  echo "[render-install] ffmpeg installed via apt-get"
else
  echo "[render-install] ERROR: ffmpeg not found and apt-get is unavailable"
  exit 1
fi

echo "[render-install] Validating toolchain"
if command -v yt-dlp >/dev/null 2>&1; then
  yt-dlp --version
else
  python -m yt_dlp --version
fi
ffmpeg -version | head -n 1

echo "[render-install] Dependencies ready"
