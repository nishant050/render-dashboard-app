@echo off
title NewsHunt Server
echo.
echo  ============================
echo   NewsHunt - Smart News Reader
echo  ============================
echo.
echo  Starting server...
echo.

:: Open browser after a short delay
start "" "http://localhost:3456"

:: Start the server (blocks until Ctrl+C)
node server.js
