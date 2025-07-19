Project Documentation: Multi-Service Dashboard & Toolkit
Last Updated: July 20, 2025

1. Project Overview & Core Concept
This project is a modular, multi-application toolkit hosted on a central web dashboard. The architecture is designed around a "microservice" concept, where different functionalities are handled by separate, independent applications. This allows for robust, scalable, and maintainable development.

The project consists of two primary, independently deployable services:

The Node.js Dashboard: The main user-facing application. It serves as a launchpad for various tools and includes its own native applications like a File Explorer and an e-Paper scraper.

The Python YouTube Downloader: A powerful, standalone Python application that provides both a user-friendly web interface (built with Streamlit) and a robust backend API (built with FastAPI) for downloading and merging high-quality YouTube videos.

The Node.js dashboard seamlessly integrates the Python application using an <iframe>, providing a unified user experience.

2. High-Level Architecture
The two services operate independently and are linked at the front-end level.

[ User's Browser ]
       |
       |--> Accesses [ Node.js Dashboard Service (on Render) ]
       |                 |
       |                 |--> Serves Dashboard UI
       |                 |--> Serves File Explorer App (uses its own Node.js API)
       |                 |--> Serves e-Paper App (uses its own Node.js API)
       |                 |--> Serves YT Downloader Page containing an <iframe>
       |
       |--> The <iframe> points to [ Python YT Downloader Service (on Render) ]
                                     |
                                     |--> Serves Streamlit UI
                                     |--> Provides a public API for video processing

3. Application 1: The Node.js Dashboard
This is the central hub of the project.

3.1. Features
Main Dashboard: A homepage with cards linking to all integrated applications.

File Explorer: A full-featured file management system with folder creation, drag-and-drop move/upload, file previews, context menus, and direct link sharing.

e-Paper Digest: A web scraper that fetches and displays the latest daily newspapers, featuring a robust caching system to improve performance.

3.2. File Structure
render-dashboard/
├── .gitignore
├── package.json
├── package-lock.json
├── server.js
├── index.html
├── style.css
├── assets/
│   └── (newspaper-logos.png)
├── apps/
│   ├── filehub/
│   │   ├── index.html, style.css, client.js
│   └── epaper/
│       ├── index.html, style.css, client.js
│   └── ytdownloader/
│       ├── index.html, style.css
├── node_modules/
└── uploads/

3.3. Key File Descriptions
File Path

Description

server.js

The core back-end. This Node.js/Express file runs the web server, serves all static files, and defines all API endpoints for the File Explorer and the e-Paper scraper.

package.json

Node.js project manifest. Lists dependencies (express, multer, axios, cheerio).

index.html (root)

The main dashboard homepage.

assets/

Contains static assets like newspaper logos.

apps/filehub/client.js

Front-end logic for the File Explorer. Manages state, handles all user interactions (drag-drop, clicks), makes API calls, and renders the UI.

apps/epaper/client.js

Front-end logic for the e-Paper app. Fetches data from the /api/newspapers endpoint.

apps/ytdownloader/index.html

A simple page that embeds the Python Streamlit application via an <iframe>.

uploads/

Temporary file storage for the File Explorer. Subject to Render's ephemeral filesystem.

3.4. API Endpoints (Node.js Service)
Method

Endpoint

Description

GET

/api/files

File Explorer: Lists contents of a directory.

POST

/api/upload

File Explorer: Uploads a file.

POST

/api/folders

File Explorer: Creates a new folder.

POST

/api/text-file

File Explorer: Creates a new .txt file.

PUT

/api/rename

File Explorer: Renames a file or folder.

PUT

/api/move

File Explorer: Moves a file or folder.

DELETE

/api/delete

File Explorer: Deletes a specific item.

DELETE

/api/clear-all

File Explorer: Deletes all contents.

GET

/api/newspapers

e-Paper: Scrapes or retrieves newspaper links from cache.

3.5. Deployment (Render)
Type: Web Service

Runtime: Node

Build Command: npm install

Start Command: node server.js

4. Application 2: The Python YouTube Downloader
A standalone, powerful service for processing YouTube videos.

4.1. Features
Streamlit UI: A user-friendly, interactive web interface for pasting a URL, selecting qualities, and downloading the final video. Includes a live terminal log.

FastAPI Backend: A robust API that handles fetching video info and processing downloads.

High-Quality Downloads: Merges separate video and audio streams using FFmpeg to provide the highest possible quality.

4.2. File Structure
youtube_downloader/
├── main.py
├── requirements.txt
├── packages.txt
└── temp_downloads/

4.3. Key File Descriptions
File Path

Description

main.py

The entire application. This single file contains both the FastAPI application (for the API) and the Streamlit application (for the UI). It uses advanced techniques to serve both from the same process.

requirements.txt

Python dependencies. Lists all required Python libraries (streamlit, fastapi, pytubefix, etc.) for pip.

packages.txt

System dependencies. Tells Render's environment to install ffmpeg using the system package manager.

temp_downloads/

Temporary file storage for downloaded and merged videos. Subject to Render's ephemeral filesystem.

4.4. API Endpoints (Python Service)
Method

Endpoint

Description

GET

/api/info

Fetches video metadata, thumbnail, and available video/audio streams with their itags.

GET

/api/download

Takes a URL, video itag, and audio itag. Downloads both, merges them, and returns the final video file.

4.5. Deployment (Render)
Type: Web Service

Runtime: Python 3

Build Command: pip install -r requirements.txt

Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT

5. Future Development
To Add a New App to the Node.js Dashboard:
Create a new folder inside /apps (e.g., /apps/todo-list/).

Build the app's front-end (HTML, CSS, JS) inside its new folder.

If it requires a backend, add new API endpoints to the main server.js file.

Add a new "app card" to the root index.html dashboard, linking to the new app.

For any app requiring persistent data, a database (e.g., Render's free Postgres) will need to be added to the Node.js service.