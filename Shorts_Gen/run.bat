@echo off
REM ⚽ Football Viral Shorts Generator – Windows Launcher
echo.
echo ⚽ Football Viral Shorts Generator
echo ----------------------------------

where python >nul 2>&1
IF ERRORLEVEL 1 (
    echo ❌ Python not found. Install Python 3.9+ from python.org
    pause
    exit /b
)

echo 🔧 Installing dependencies...
python -m pip install moviepy opencv-python numpy scipy -q

echo ✅ Ready! Launching...
python "%~dp0app.py"
pause
