@echo off
REM Page Engager — Quick Setup (Windows)
echo === Page Engager Setup ===
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Node.js not found. Install from https://nodejs.org/ v18+
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo Node.js: %%i

REM Install dependencies
echo.
echo Installing dependencies...
call npm install

REM Install Playwright
echo.
echo Installing Chromium browser...
call npx playwright install chromium

REM Setup .env
if not exist .env (
    echo.
    echo Creating .env file...
    copy .env.example .env
    echo.
    echo IMPORTANT: Edit .env and set your ANTHROPIC_API_KEY
    echo   Get key from: https://console.anthropic.com/
    echo.
    set /p api_key="Enter your Anthropic API key (or press Enter to skip): "
    if defined api_key (
        powershell -Command "(Get-Content .env) -replace 'sk-ant-your-key-here', '%api_key%' | Set-Content .env"
        echo API key saved to .env
    )
)

REM Setup database
echo.
echo Setting up database...
call npx drizzle-kit push

echo.
echo === Setup Complete ===
echo.
echo To start: npm run dev
echo Then open: http://localhost:5173
echo.
echo First time? Go to Settings - select Chrome Profile - select your Page
pause
