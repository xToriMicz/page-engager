# Changelog

## v1.0.0 (2026-03-30)

### Features

**Engage (Semi-Auto)**
- Select multiple targets (chip selector + Select All)
- Scan posts from target pages — sort newest first
- AI analyze each post: type (greeting/normal/sale/review/news/share), rating (1-5 stars), summary
- AI generate comments or use custom comments (random pick)
- Send comment to Facebook — human-like typing speed + delays
- Post metadata: link, comment count, reactions, date, media type (Photo/Video/Text)
- Scan cache — results persist across page refresh

**Auto Engage (Full Auto)**
- 1-click: scan all targets → AI generate → auto-send comments
- Configurable: max posts/target (1-5), delay between comments (30-300s), rounds/day
- Skip already-commented posts (URL normalized duplicate check)
- Stop button to abort mid-run
- 30-minute auto-timeout safety

**Discover People**
- Scan your page's posts to find commenters
- Switch to page profile automatically (same-tab switch)
- Auto-save discovered engagers as targets with engagement count
- Engagement score accumulates across discover runs

**Custom Comments**
- Add custom comment phrases (1 line = 1 comment)
- Import from .txt file
- Used randomly instead of AI when available
- Works with both Auto and Semi-Auto

**Preview (PiP)**
- Floating picture-in-picture window — visible on all tabs
- Live browser stream via WebSocket (CDP screenshot)
- Auto-show when browser starts working
- Expand/shrink/minimize controls
- LIVE badge + FPS counter + action status

**Targets**
- Add manually (auto-fetches page name from Facebook)
- Discover engagers (auto-save)
- Engagement count, last seen, source badge (Discovered/Manual)
- Remove individual or Remove All

**Activity**
- Comment history log
- Daily report with stats
- Engagement notifications

**Settings**
- Select Facebook page to act as
- Toggle headless mode (Preview PiP vs visible browser)
- Chrome connection status

### Tech Stack
- **Frontend**: React 19 + Tailwind CSS 4 + Vite
- **Backend**: Hono + Node.js
- **Database**: SQLite + Drizzle ORM
- **Browser**: Playwright (Chromium)
- **AI**: Claude Haiku (Anthropic API)
- **Preview**: CDP screenshot + WebSocket binary stream
