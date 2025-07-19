Project Documentation: Multi-App Dashboard
Last Updated: July 20, 2025

1. Project Purpose & Core Concept
The primary goal of this project is to create a single, centralized web dashboard that serves as a launchpad for multiple, independent web applications. This modular architecture allows for easy development and addition of new projects over time without altering the core structure.

The entire system is designed to be hosted on Render's free tier, making it a cost-effective platform for personal projects and prototypes.

The first application integrated into this dashboard is the "File Hub", a simple yet functional utility for uploading and downloading files from any location.

2. Application Architecture
The project is architecturally divided into two main parts: the Dashboard and the Applications.

2.1. The Dashboard (Static Front-End)
Role: Acts as the main entry point and navigation hub.

Technology: It's a simple, static website built with HTML and CSS. It contains "cards" that link to the various applications.

Hosting: It is served as a static site by the main server.js file.

2.2. The "File Hub" Application (Full-Stack)
Role: A self-contained application for file management.

Front-End (apps/filehub/): Built with HTML, CSS, and vanilla JavaScript. It provides the user interface for uploading files and viewing the list of available files.

Back-End (server.js): A Node.js server using the Express framework. It handles the business logic.

Client-Server Interaction:

File Uploads: The front-end uses the fetch API to send a POST request with the file data to the /upload endpoint on the server.

File Listing: On page load, the front-end sends a GET request to the /files endpoint. The server responds with a JSON array of filenames, which the front-end then uses to dynamically render the list.

File Downloads: The download links on the front-end point directly to the static files served from the /uploads directory on the server.

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

The heart of the back-end. This Node.js/Express file starts the web server, serves all static front-end files (including the dashboard and apps), and defines the API endpoints (/upload, /files) for the File Hub application. It uses the multer library to process file uploads.

package.json

Node.js project manifest. It lists project metadata and, most importantly, the dependencies (express, multer) required to run the server. Render uses this file to know what to install with npm install.

index.html (root)

The main dashboard page. This is the homepage of the entire project. It contains the grid of "app cards" that link to individual applications.

style.css (root)

The stylesheet exclusively for the main dashboard (index.html).

.gitignore

Specifies files for Git to ignore. Crucially, it prevents the node_modules and uploads directories from being committed to the GitHub repository, which is essential for a clean and efficient deployment.

apps/filehub/index.html

The main HTML file for the File Hub application's user interface. Contains the upload form and the area where the file list is displayed.

apps/filehub/style.css

The stylesheet exclusively for the File Hub application.

apps/filehub/client.js

Front-end logic for the File Hub app. This file handles all user interactions: listening for the form submission, sending the file to the server via fetch, and fetching/displaying the list of uploaded files.

uploads/ (directory)

File storage location. The server.js is configured to save all uploaded files into this directory. This directory is intentionally not tracked by Git.

node_modules/ (directory)

Contains all the installed Node.js packages (dependencies). This is managed by npm and is not included in the repository.

4. Deployment on Render
The project is deployed as a single Web Service on Render.

Repository: Render is connected directly to the project's GitHub repository.

Build Command: npm install

This command reads package.json and installs Express and Multer on the Render server.

Start Command: node server.js

This command executes the main server file, starting the web service after a successful build.

Important Consideration: Ephemeral Filesystem
Render's free tier uses an ephemeral filesystem. This means that any files written to the disk (like those in the /uploads folder) are temporary. They will be permanently deleted whenever the service restarts or spins down due to inactivity (15 minutes). This makes the current File Hub app suitable for temporary file sharing but not for permanent storage.

5. Future Development
To add a new application (e.g., "ToDo List"):

Create a new folder inside /apps (e.g., /apps/todolist/).

Build the new app's front-end (HTML, CSS, JS) inside its new folder.

Add new API endpoints to the main server.js file to handle the back-end logic for the new app.

Add a new "app card" to the main index.html dashboard, linking to the new app's HTML file.

For any app requiring persistent data (like a ToDo list), a database (e.g., Render's free Postgres) will need to be added.