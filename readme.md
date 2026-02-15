<div align="center">

# 🚀 Render Dashboard App

### A beautiful all-in-one personal productivity dashboard

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](#)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](#)
[![Frontend](https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20Vanilla%20JS-ff69b4)](#)
[![Status](https://img.shields.io/badge/Status-Active-success)](#)

</div>

---

## ✨ What this project is

**Render Dashboard App** is a single Node.js web application that acts like a mini “app store” for personal tools.

You open one dashboard and launch multiple built-in utilities:

- ☁️ **File Hub** (upload, organize, move, preview files)
- 🗞️ **e-Paper Digest** (daily newspaper links with logo cards)
- 🎬 **YT Downloader** (job-based YouTube processing pipeline)
- 🤖 **News Agent** (AI-powered topic summaries using Groq)
- 📝 **Quick Notes** (browser-local notes)
- 📈🧠 Additional static utility pages (learning/health/event pages)

---

## 🧭 Dashboard apps at a glance

| App | Purpose | Backend Required |
|---|---|---|
| `apps/filehub` | File explorer with upload, folder/file actions, drag/drop move | ✅ Yes |
| `apps/epaper` | Fetches latest newspaper links from configured sources | ✅ Yes |
| `apps/ytdownloader` | Starts async download job, polls progress, shows completed media | ✅ Yes |
| `apps/newsagent` | Manage news sections + stream AI summaries | ✅ Yes |
| `apps/quicknotes` | Save quick notes to `localStorage` | ❌ No |
| `apps/learn-investing` | Static course/tracker style page | ❌ No |
| `apps/vestibular-migraine` | Static rehab tracker UI | ❌ No |
| `apps/siat` | Static exhibition/stall exploration page | ❌ No |

---

## 🏗️ How it works

### 1) Core server

`server.js` runs an Express server that:

- serves all static files from repo root
- serves `/uploads`, `/assets`, and `/public`
- exposes APIs for File Hub, e-Paper, News Agent, and YT Downloader workflow

### 2) Data and storage

- `uploads/` → File Hub filesystem storage
- `news_settings.json` → News Agent section config
- `public/videos.json` → downloaded video metadata manifest
- `public/videos/` → final media files

### 3) Async YouTube flow

1. Frontend calls `POST /api/ytdownloader/start-download`
2. Server creates a job ID and triggers GitHub `repository_dispatch`
3. External runner executes `scripts/download_video.py`
4. Python script downloads/merges media via `yt-dlp` + `ffmpeg`
5. Runner pushes updates to `POST /api/ytdownloader/update-progress`
6. UI polls `GET /api/ytdownloader/status/:jobId` and updates cards

---

## 🔌 API overview

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

### News Agent

- `GET /api/news-sections`
- `POST /api/news-sections`
- `PUT /api/news-sections/:id`
- `DELETE /api/news-sections/:id`
- `GET /api/summarize-all` (Server-Sent Events stream)
- `POST /api/groq-chat` (server-side proxy for Groq)

### YT Downloader

- `POST /api/ytdownloader/start-download`
- `POST /api/ytdownloader/update-progress`
- `GET /api/ytdownloader/status/:jobId`

---

## ⚙️ Environment variables

### Required for News Agent

- `GROQ_API_KEY` *(or `REDACTED_GROQ_API_KEY`)*

### Required for YT Downloader automation

- `GITHUB_USER`
- `GITHUB_REPO`
- `GITHUB_PAT`
- `PROGRESS_UPDATE_SECRET`
- `RENDER_APP_URL` *(used by workflow/script callback)*

### Optional

- `PORT` (default: `3000`)

---

## 🧪 Run locally

```bash
npm install
node server.js
```

Open: `http://localhost:3000`

---

## 📁 Project structure

```text
.
├── server.js
├── index.html
├── style.css
├── apps/
│   ├── filehub/
│   ├── epaper/
│   ├── ytdownloader/
│   ├── newsagent/
│   ├── quicknotes/
│   ├── learn-investing/
│   ├── vestibular-migraine/
│   └── siat/
├── assets/
├── public/
│   ├── videos/
│   ├── videos.json
│   └── videos/videos.json
├── scripts/
│   └── download_video.py
├── news_settings.json
├── package.json
└── requirements.txt
```

---

## 📝 Notes

- This is a **single-repo multi-tool personal project** (not microservices).
- Job status for YouTube workflow is currently in-memory (`jobs` object), so active job state resets after server restart.
- Filesystem persistence behavior depends on your hosting plan/environment.

---

## ❤️ Why this repo is useful

If you want one deployable app that combines:

- file handling,
- scraping,
- AI summarization,
- async background workflow integration,
- and small self-contained utility pages,

this project is a practical and extensible starting point.
