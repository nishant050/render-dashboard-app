# Render Dashboard App

A personal **multi-tool web dashboard** built with Node.js + vanilla front-end apps.

This project acts as a single home screen for practical everyday tools: file management, newspaper digest, AI-powered news summaries, YouTube download orchestration, and a few self-contained learning/utility pages.

---

## What this app does

At a high level, the app is:

- A central dashboard (`/`) that links to multiple mini-apps
- A Node/Express backend (`server.js`) that powers API features
- A static front-end bundle under `apps/` for each tool
- A hybrid system where some features are local (browser-only), while others are server-driven

### Included mini-apps

- **File Hub** (`apps/filehub`)  
  Browser-based file manager for the server `uploads/` folder.
- **e-Paper Digest** (`apps/epaper`)  
  Scrapes configured newspaper sources and shows latest links with logos.
- **YT Downloader** (`apps/ytdownloader`)  
  Starts YouTube download jobs and tracks progress via polling.
- **News Agent** (`apps/newsagent`)  
  AI-generated news summaries from configurable topics and source sites.
- **Quick Notes** (`apps/quicknotes`)  
  Simple localStorage notes app (no backend dependency).
- **Learn Investing / Vestibular Migraine / SIAT pages**  
  Standalone static learning/tracker pages linked from the dashboard.

---

## Architecture overview

### Backend

- **Runtime:** Node.js + Express
- **Entry point:** `server.js`
- **Key dependencies:** `express`, `multer`, `axios`, `cheerio`, `groq-sdk`
- **Storage pattern:**
  - `uploads/` for File Hub files
  - `public/videos/` + `public/videos.json` for downloaded video artifacts and manifest
  - `news_settings.json` for News Agent section configuration

### Frontend

- Dashboard page: `index.html` + `style.css`
- Each tool has its own `apps/<tool>/index.html` and optional `client.js`, `style.css`
- Plain HTML/CSS/JS (no React/Vue build system)

### Async download workflow (YouTube)

1. UI posts URL to `POST /api/ytdownloader/start-download`
2. Server triggers a GitHub repository dispatch event
3. External job runs `scripts/download_video.py` (yt-dlp + ffmpeg)
4. Job reports status back to `POST /api/ytdownloader/update-progress`
5. UI polls `GET /api/ytdownloader/status/:jobId`
6. Final media is listed from `public/videos.json`

---

## Core API surface

### File Hub APIs

- `GET /api/files`
- `POST /api/upload`
- `POST /api/folders`
- `POST /api/text-file`
- `PUT /api/rename`
- `PUT /api/move`
- `DELETE /api/delete`
- `DELETE /api/clear-all`

### e-Paper API

- `GET /api/newspapers`

### News Agent APIs

- `GET /api/news-sections`
- `POST /api/news-sections`
- `PUT /api/news-sections/:id`
- `DELETE /api/news-sections/:id`
- `GET /api/summarize-all` (SSE stream)
- `POST /api/groq-chat`

### YouTube job APIs

- `POST /api/ytdownloader/start-download`
- `POST /api/ytdownloader/update-progress`
- `GET /api/ytdownloader/status/:jobId`

---

## Environment variables

Set these before running production features:

### Required for News Agent

- `GROQ_API_KEY` (or `REDACTED_GROQ_API_KEY`)

### Required for YT Downloader orchestration

- `GITHUB_USER`
- `GITHUB_REPO`
- `GITHUB_PAT`
- `PROGRESS_UPDATE_SECRET`

### Optional

- `PORT` (defaults to `3000`)

---

## Local development

```bash
npm install
node server.js
```

Then open: `http://localhost:3000`

---

## Repository layout

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
│   └── videos.json
├── scripts/
│   └── download_video.py
├── news_settings.json
└── requirements.txt
```

---

## Notes and practical constraints

- This is a **personal dashboard-style monorepo** with mixed app maturity levels.
- File and video storage are filesystem-based (not DB-backed).
- YouTube jobs are tracked in **in-memory server state** (`jobs` object), so server restarts clear active job status.
- Several pages are intentionally static and self-contained.

If you want, I can also generate a second version of this README with badges, screenshots, and a deployment section tailored specifically for Render.
