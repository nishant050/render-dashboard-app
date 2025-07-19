Project Documentation: Multi-App Dashboard
Last Updated: July 20, 2025

1. Project Purpose & Core Concept
The primary goal of this project is to create a single, centralized web dashboard that serves as a launchpad for multiple, independent web applications. This modular architecture allows for easy development and addition of new projects over time without altering the core structure.

The entire system is designed to be hosted on Render's free tier, making it a cost-effective platform for personal projects and prototypes.

The first application integrated into this dashboard is the "File Explorer", a feature-rich file management system that supports folder creation, drag-and-drop uploads, file previews, and more.

2. Application Architecture
The project is architecturally divided into two main parts: the Dashboard and the Applications.

2.1. The Dashboard (Static Front-End)
Role: Acts as the main entry point and navigation hub.

Technology: It's a simple, static website built with HTML and CSS. It contains "cards" that link to the various applications.

Hosting: It is served as a static site by the main server.js file.

2.2. The "File Explorer" Application (Full-Stack)
Role: A self-contained, full-featured file explorer application.

Front-End (apps/filehub/): Built with HTML, CSS, and vanilla JavaScript. It provides a modern user interface with:

Folder and file rendering with thumbnails for images/videos.

Drag-and-drop support for both uploading new files and moving existing items into folders.

Breadcrumb navigation for easy traversal of the directory structure.

Modals for creating new folders, new text files, and renaming items.

A context menu (right-click) for actions like Rename, Delete, and Copying a direct link.

A built-in previewer for images, videos, and text-based files.

Back-End (server.js): A Node.js server using the Express framework. It handles all the file system logic.

3. File Structure & Key Files
Here is the complete file structure of the project.

render-dashboard/
├── .gitignore
├── package.json
├── package-lock.json
├── server.js
├── index.html
├── style.css
├── apps/
│   └── filehub/
│       ├── index.html
│       ├── style.css
│       └── client.js
├── node_modules/
└── uploads/

Key File Descriptions
File Path

Description

server.js

The heart of the back-end. This Node.js/Express file starts the web server, serves all static front-end files, and defines the comprehensive API for the File Explorer. It uses multer for uploads and Node's fs module for all file system operations (create, read, update, delete, move).

package.json

Node.js project manifest. It lists project metadata and the dependencies (express, multer) required to run the server. Render uses this file to know what to install with npm install.

index.html (root)

The main dashboard page. This is the homepage of the entire project. It contains the grid of "app cards" that link to individual applications.

style.css (root)

The stylesheet exclusively for the main dashboard (index.html).

.gitignore

Specifies files for Git to ignore. Crucially, it prevents the node_modules and uploads directories from being committed to the GitHub repository, which is essential for a clean and efficient deployment.

apps/filehub/index.html

The main HTML file for the File Explorer's user interface. Contains the layout for the toolbar, breadcrumbs, file grid, and all necessary modals.

apps/filehub/style.css

The stylesheet for the File Explorer, including styles for items, modals, context menus, and drag-and-drop feedback.

apps/filehub/client.js

Front-end logic for the File Explorer. This extensive file manages the application's state (like the current path), handles all user interactions, makes API calls to the back-end, and dynamically renders the UI.

uploads/ (directory)

File storage location. The server.js is configured to save all uploaded files and created folders into this directory. This directory is intentionally not tracked by Git.

node_modules/ (directory)

Contains all the installed Node.js packages (dependencies). This is managed by npm and is not included in the repository.

4. API Endpoints
The server.js exposes the following API endpoints, all prefixed with /api.

Method

Endpoint

Body / Query

Description

GET

/files

?path=<folder>

Lists all files and folders within the specified path.

POST

/upload

FormData

Uploads a single file to the specified path within the form data.

POST

/folders

{name, path}

Creates a new folder with the given name inside the specified path.

POST

/text-file

{filename, content, path}

Creates a new .txt file with the given content.

PUT

/rename

{oldName, newName, path}

Renames a file or folder.

PUT

/move

{sourcePath, targetPath}

Moves a file or folder from a source to a target path.

DELETE

/delete

{name, path}

Deletes a specific file or folder.

DELETE

/clear-all

(none)

Deletes all contents of the root uploads directory.

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