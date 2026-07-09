@echo off
title 9Router Tools Launcher
echo Starting 9Router Tools Server...
start "" /min node server.js
ping 127.0.0.1 -n 3 >nul
echo Opening dashboard...
start http://localhost:3000
echo 9Router Tools started successfully!
exit
