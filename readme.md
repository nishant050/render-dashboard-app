Project Documentation: Multi-App Dashboard
Last Updated: July 20, 2025

1. Project Purpose & Core Concept
The primary goal of this project is to create a single, centralized web dashboard that serves as a launchpad for multiple, independent web applications. This modular architecture allows for easy development and addition of new projects over time without altering the core structure.

The entire system is designed to be hosted on Render's free tier, making it a cost-effective platform for personal projects and prototypes.

Currently, the dashboard hosts two main applications:

File Explorer: A feature-rich file management system that mimics a desktop file explorer, complete with folder navigation, drag-and-drop actions, and file previews.

e-Paper Digest: A dynamic web scraper that fetches and displays the latest daily newspapers from various online sources.

2. Application Architecture
The project is architecturally divided into three main parts: the Dashboard, the File Explorer, and the e-Paper Digest.

2.1. The Dashboard (Static Front-End)
Role: Acts as the main entry point and navigation hub.

Technology: A simple, static website built with HTML and CSS. It contains "cards" that link to the various applications.

2.2. The "File Explorer" Application (Full-Stack)
Role: A self-contained, full-featured file explorer application.

Front-End (apps/filehub/): Built with HTML, CSS, and vanilla JavaScript. It provides a modern user interface with:

Folder and file rendering with thumbnails for images/videos.

Drag-and-drop support for both uploading new files and moving existing items into folders or parent directories (via breadcrumbs).

Breadcrumb navigation for easy traversal of the directory structure.

Modals for creating new folders, new text files, and renaming items.

A context menu (right-click) for actions like Rename, Delete, and Copying a direct link.

A built-in previewer for images, videos, and text-based files.

A "Clear All" function to wipe the storage.

Back-End (server.js): The Node.js server handles all file system logic using the fs module and manages uploads with multer.

2.3. The "e-Paper Digest" Application (Dynamic)
Role: A dynamic application that scrapes and displays newspaper links.

Front-End (apps/epaper/): A clean interface that displays a loading spinner, fetches data from the back-end, and renders a grid of newspaper cards with their logos and links.

Back-End (server.js):

Scraping: Uses axios to fetch HTML from newspaper websites and cheerio to parse the HTML and find the correct download links.

Caching: Implements a 4-hour cache to prevent re-scraping on every request, significantly improving performance and reducing load on the source websites.

Asset Management: Automatically serves local icons from the /assets directory based on the newspaper's name.

3. File Structure & Key Files
Here is the complete file structure of the project.

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
│   │   ├── index.html
│   │   ├── style.css
│   │   └── client.js
│   └── epaper/
│       ├── index.html
│       ├── style.css
│       └── client.js
├── node_modules/
└── uploads/

Key File Descriptions
File Path

Description

server.js

The heart of the back-end. This Node.js/Express file starts the web server, serves all static files (/, /apps, /assets, /uploads), and defines all API endpoints for both the File Explorer and the e-Paper scraper.

package.json

Node.js project manifest. It lists project metadata and dependencies (express, multer, axios, cheerio). Render uses this file to know what to install with npm install.

assets/ (directory)

Contains local static assets, such as the newspaper logos, for reliable and fast loading.

apps/filehub/client.js

Front-end logic for the File Explorer. This extensive file manages the application's state, handles all user interactions (drag-drop, clicks, context menus), makes API calls, and dynamically renders the UI.

apps/epaper/client.js

Front-end logic for the e-Paper app. This file fetches data from the /api/newspapers endpoint and renders the results into the grid.

uploads/ (directory)

File storage location. The server saves all uploaded files and created folders here. This directory is intentionally not tracked by Git.

4. API Endpoints
The server.js exposes the following API endpoints, all prefixed with /api.

Method

Endpoint

Body / Query

Description

GET

/files

?path=<folder>

File Explorer: Lists all files and folders within the specified path.

POST

/upload

FormData

File Explorer: Uploads a single file to the specified path.

POST

/folders

{name, path}

File Explorer: Creates a new folder.

POST

/text-file

{filename, content, path}

File Explorer: Creates a new .txt file.

PUT

/rename

{oldName, newName, path}

File Explorer: Renames a file or folder.

PUT

/move

{sourcePath, targetPath}

File Explorer: Moves a file or folder.

DELETE

/delete

{name, path}

File Explorer: Deletes a specific file or folder.

DELETE

/clear-all

(none)

File Explorer: Deletes all contents of the root uploads directory.

GET

/newspapers

(none)

e-Paper: Scrapes or retrieves from cache the list of newspapers and their links.

5. Deployment on Render
The project is deployed as a single Web Service on Render.

Repository: Render is connected directly to the project's GitHub repository.

Build Command: npm install

Start Command: node server.js

Important Consideration: Ephemeral Filesystem
Render's free tier uses an ephemeral filesystem. This means that any files written to the disk (like those in the /uploads folder) are temporary. They will be permanently deleted whenever the service restarts or spins down due to inactivity (15 minutes). This makes the current File Explorer app suitable for temporary file sharing and testing but not for permanent storage.

6. Future Development
To add a new application (e.g., "ToDo List"):

Create a new folder inside /apps (e.g., /apps/todolist/).

Build the new app's front-end (HTML, CSS, JS) inside its new folder.

Add new API endpoints to the main server.js file to handle the back-end logic for the new app.

Add a new "app card" to the main index.html dashboard, linking to the new app's HTML file.

For any app requiring persistent data (like a ToDo list), a database (e.g., Render's free Postgres) will need to be added.