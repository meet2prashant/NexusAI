@echo off
title Nexus AI Launcher
echo Starting Nexus AI Document Summarizer...

:: 1. Start the Python backend FastAPI server in a new visible window
start "Nexus Backend Server" cmd /k "cd backend && venv\Scripts\python.exe -m uvicorn main:app --port 8000"

:: 2. Wait 2 seconds for the server to properly boot up
timeout /t 2 /nobreak >nul

:: 3. Open the localhost address in the default Windows web browser
echo Opening the application in your browser...
start "" "http://127.0.0.1:8000"

echo Nexus successfully started! 
exit
