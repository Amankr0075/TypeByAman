@echo off
cd /d "%~dp0"
start "" /b node cursor-helper.js >> "%~dp0err.log" 2>&1
