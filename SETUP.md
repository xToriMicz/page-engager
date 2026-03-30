# Page Engager — Setup Guide

## Requirements

- **Node.js** 18+ (recommend 22)
- **Chrome** installed (for cookie extraction)
- **Anthropic API Key** for AI comment generation

## Quick Start (Mac/Linux/Windows)

```bash
# 1. Clone
git clone https://github.com/xToriMicz/page-engager.git
cd page-engager

# 2. Install dependencies
npm install

# 3. Install Playwright browsers
npx playwright install chromium

# 4. Setup environment
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY

# 5. Setup database
npx drizzle-kit push

# 6. Start (development)
npm run dev
# Opens: http://localhost:5173

# 7. Start (production)
npm run build
npm start
# Opens: http://localhost:3000
```

## Environment Variables (.env)

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional
HEADLESS=true           # true = watch in Preview PiP, false = visible browser
CHROME_PROFILE=Profile 8  # Chrome profile directory name for cookie extraction
WS_PORT=3001            # WebSocket port for Preview stream
```

## Finding Your Chrome Profile

The app extracts Facebook cookies from your Chrome profile to login automatically.

**Mac:**
```bash
ls ~/Library/Application\ Support/Google/Chrome/ | grep Profile
# Usually: Default, Profile 1, Profile 2, etc.
```

**Windows:**
```bash
dir "%LOCALAPPDATA%\Google\Chrome\User Data" | findstr Profile
# Usually: Default, Profile 1, Profile 2, etc.
```

**Linux:**
```bash
ls ~/.config/google-chrome/ | grep -E "Default|Profile"
```

To find which profile is logged into Facebook:
1. Open Chrome
2. Go to `chrome://version`
3. Look at "Profile Path" — the last folder name is your profile

Set it in `.env`:
```bash
CHROME_PROFILE=Profile 8
```

## Update (When Code Changes)

```bash
# Pull latest code
git pull

# Install new dependencies (if any)
npm install

# Run database migrations (if schema changed)
npx drizzle-kit push

# Restart
npm run dev
```

## Windows-Specific Notes

1. **better-sqlite3** needs build tools:
   ```bash
   npm install -g windows-build-tools
   # OR install Visual Studio Build Tools with C++ workload
   ```

2. **Playwright** on Windows:
   ```bash
   npx playwright install chromium
   # If firewall blocks, allow Node.js
   ```

3. **Chrome cookie path** on Windows:
   ```
   %LOCALAPPDATA%\Google\Chrome\User Data\{Profile}\Cookies
   ```
   The app reads this automatically — just set `CHROME_PROFILE` correctly.

## Data

All data stored in `data/page-engager.db` (SQLite):
- Targets (discovered + manual)
- Comments history
- Scan cache
- Settings

**Backup:** Copy `data/page-engager.db` to save all your data.
**Move to new machine:** Copy `data/` folder + `.env` to the new machine.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Cookie extraction fails | Check CHROME_PROFILE, close Chrome before starting |
| Browser not connecting | `npx playwright install chromium` |
| AI not generating | Check ANTHROPIC_API_KEY in .env |
| Port in use | Kill old process: `lsof -ti:3000 | xargs kill` (Mac/Linux) or `netstat -ano | findstr :3000` (Windows) |
| DB errors after update | Run `npx drizzle-kit push` |
