<div align="center">

# ðŸš€ Render Dashboard App

### A beautiful all-in-one personal productivity dashboard

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](#)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](#)
[![Frontend](https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20Vanilla%20JS-ff69b4)](#)
[![Status](https://img.shields.io/badge/Status-Active-success)](#)

</div>

---

## âœ¨ What this project is

**Render Dashboard App** is a single Node.js web application that acts like a mini â€œapp storeâ€ for personal tools.
<div align="center">

# ðŸš€ Render Dashboard App

### A beautiful all-in-one personal productivity dashboard

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](#)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](#)
[![Frontend](https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20Vanilla%20JS-ff69b4)](#)
[![Status](https://img.shields.io/badge/Status-Active-success)](#)

</div>

---

## âœ¨ What this project is

**Render Dashboard App** is a single Node.js web application that acts like a mini â€œapp storeâ€ for personal tools.

You open one dashboard and launch multiple built-in utilities:

- â˜ï¸ **File Hub** (upload, organize, move, preview files)
- ðŸ—žï¸ **e-Paper Digest** (daily newspaper links with logo cards)
- ðŸŽ¬ **YT Downloader** (local `yt-dlp` + `ffmpeg` downloader with video library)
- 📰 **NewsHunt** (AI-powered smart news reader with RSS feeds)
- ðŸ“ **Quick Notes** (browser-local notes)
- ðŸ“ˆðŸ§  Additional static utility pages (learning/health/event pages)

---

## ðŸ§­ Dashboard apps at a glance

| App | Purpose | Backend Required |
|---|---|---|
| `apps/filehub` | File explorer with upload, folder/file actions, drag/drop move | âœ… Yes |
| `apps/epaper` | Fetches latest newspaper links from configured sources | âœ… Yes |
| `apps/ytdownloader` | Fetches video info, downloads locally, stores and plays videos | Yes |
| `apps/newshunt` | AI-powered smart news reader with RSS, categorization & chat | ✅ Yes (proxy) |
| `apps/quicknotes` | Save quick notes to `localStorage` | âŒ No |
| `apps/learn-investing` | Static course/tracker style page | âŒ No |
| `apps/vestibular-migraine` | Static rehab tracker UI | âŒ No |
| `apps/siat` | Static exhibition/stall exploration page | âŒ No |

---

## ðŸ—ï¸ How it works

### 1) Core server

`server.js` runs an Express server that:

- serves all static files from repo root
- serves `/uploads`, `/assets`, and `/public`
- exposes APIs for File Hub, e-Paper, NewsHunt (CORS proxy), and YT Downloader

### 2) Data and storage

- `uploads/` â†’ File Hub filesystem storage
- NewsHunt stores feed config in browser IndexedDB (no server-side config file)
- `public/videos/` -> downloaded videos + thumbnails/info sidecar files

### 3) Local YouTube download flow

1. Frontend calls `GET /api/video-info` for metadata + qualities
2. Frontend starts download with `POST /api/download`
3. Server runs local `yt-dlp` process and tracks progress in memory
4. UI polls `GET /api/download-progress/:downloadId`
5. Downloaded files are stored in `public/videos/`
6. Library is loaded from `GET /api/library`

---

## ðŸ”Œ API overview

### File Hub

- `GET /api/files`
- `POST /api/upload`
- `POST /api/folders`
- `POST /api/text-file`
- `PUT /api/rename`
- `PUT /api/move`
- `DELETE /api/delete`
- `DELETE /api/clear-all`

### e-Paper

- `GET /api/newspapers`

### NewsHunt

- `GET /proxy?url=...` (fetches external RSS feeds server-side to bypass CORS)
- `GET /api/newshunt/ai-config` (provides API keys from server env vars)
- `GET /api/newshunt/sync` (pull synced article state, feeds, settings)
- `POST /api/newshunt/sync` (push & merge article state, feeds, settings)
- `POST /api/newshunt/settings` (save individual setting to server)
- `POST /api/newshunt/mark-read` (quick mark single article as read)
- `POST /api/newshunt/feeds` (save feed subscriptions)

### YT Downloader

- `GET /api/video-info`
- `POST /api/download`
- `GET /api/download-progress/:downloadId`
- `GET /api/dependencies`
- `GET /api/library`
- `GET /api/video/:filename`
- `DELETE /api/video/:filename`
- `GET /api/settings`
- `POST /api/settings/proxy`

---

## ⚙️ Environment variables

### Required runtime dependencies for YT Downloader

- `yt-dlp` installed and available on PATH
- `ffmpeg` installed and available on PATH

### Optional

- `PORT` (default: `3000`)
- `YTDLP_PATH` (full path to `yt-dlp` binary if not in PATH)
- `FFMPEG_PATH` (full path to `ffmpeg` binary if not in PATH)

---

## ðŸ§ª Run locally

```bash
npm install
node server.js
```

Open: `http://localhost:3000`

### Verify local dependencies

```bash
yt-dlp --version
python -m yt_dlp --version
ffmpeg -version
```

### Render native deployment (repo-driven)

This repo includes `render.yaml` and simple npm scripts for Render.

1. Deploy the service from this repository using Render Blueprint.
2. Use these commands if setting manually in Render:
   - Build Command: `npm run render:build`
   - Start Command: `npm start`
3. Confirm build logs include:
   - `python -m pip install --upgrade pip`
   - `pip install -r requirements.txt`
3. Confirm runtime checks:
   - `GET /api/dependencies` returns both `yt_dlp.ok=true` and `ffmpeg.ok=true`.

### Troubleshooting

- Error: `No module named yt_dlp`
  - Build did not run `pip install -r requirements.txt`, or install failed.
- Error: `spawn yt-dlp ENOENT`
  - `yt-dlp` not on PATH. Set `YTDLP_PATH` or verify Python module fallback.
- Error: ffmpeg missing
  - Strict mode is enabled; downloads are blocked. Set `FFMPEG_PATH` to a valid binary if needed.
## ðŸ“ Notes

- This is a **single-repo multi-tool personal project** (not microservices).
- Job status for YT Downloader is currently in-memory (`downloads` map), so active job state resets after server restart.
- Filesystem persistence behavior depends on your hosting plan/environment.

---

## â¤ï¸ Why this repo is useful

If you want one deployable app that combines:

- file handling,
- scraping,
- AI summarization,
- async background workflow integration,
- and small self-contained utility pages,

this project is a practical and extensible starting point.

