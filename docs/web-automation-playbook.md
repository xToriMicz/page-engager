# Web Automation Playbook — Playwright + Facebook

> บทเรียนจากการพัฒนา Page Engager v1.0.0
> สำหรับใช้อ้างอิงในโปรเจค automation อื่นๆ

## Architecture

```
Frontend (React + Vite)
  ↕ REST API + WebSocket
Backend (Hono + Node.js)
  ↕ Playwright
Browser (Chromium headless/visible)
  ↕ Facebook DOM
```

## 1. Browser Management

### Launch + Cookie Injection
```typescript
import { chromium } from "playwright";

// Launch browser
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-blink-features=AutomationControlled", "--no-first-run"],
});

// Create context with realistic user agent
const context = await browser.newContext({
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...",
  viewport: { width: 1280, height: 800 },
});

// Inject cookies from Chrome profile
const cookies = extractCookiesFromChrome("Profile 8");
await context.addCookies(cookies);
```

### Reuse Browser Session
```typescript
let browser: Browser | null = null;
let context: BrowserContext | null = null;

export async function getContext(): Promise<BrowserContext> {
  if (context && browser?.isConnected()) return context;
  // Reconnect if lost
  await closeBrowser();
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ ... });
  return context;
}
```

### Key Lesson
- **newPage() ทุก action** — เปิด page ใหม่ทุกครั้ง ปิดเมื่อเสร็จ ป้องกัน state leak
- **reuse context** — cookie/session persist ข้าม pages
- **closeBrowser()** เมื่อต้อง reset (เปลี่ยน profile, เปลี่ยน headless)

## 2. Cookie Extraction (Chrome)

### Mac
```typescript
import { execSync } from "child_process";
import { pbkdf2Sync, createDecipheriv } from "crypto";

// Get Chrome encryption key
const password = execSync('security find-generic-password -s "Chrome Safe Storage" -w').toString().trim();
const key = pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1");

// Decrypt cookie value (v10 format)
function decrypt(encrypted: Buffer, key: Buffer): string {
  if (encrypted.subarray(0, 3).toString() !== "v10") return "";
  const iv = Buffer.alloc(16, " ");
  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([decipher.update(encrypted.subarray(3)), decipher.final()]).toString();
}
```

### Cross-platform paths
```
Mac:    ~/Library/Application Support/Google/Chrome/{Profile}/Cookies
Windows: %LOCALAPPDATA%\Google\Chrome\User Data\{Profile}\Cookies
Linux:  ~/.config/google-chrome/{Profile}/Cookies
```

## 3. Human-Like Behavior

### Delays
```typescript
function randomDelay(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Between actions: 3-6 seconds (reading time)
await page.waitForTimeout(randomDelay(3000, 6000));

// Between targets: 5-10 seconds
await page.waitForTimeout(randomDelay(5000, 10000));

// Scroll like human
await page.evaluate((px) => window.scrollBy({ top: px, behavior: "smooth" }), 600 + Math.random() * 500);
```

### Typing
```typescript
// Thai text: use insertText (more reliable than type)
await page.keyboard.insertText("สวัสดีครับ");

// English/mixed: character by character
for (const char of text) {
  await page.keyboard.type(char, { delay: 30 + Math.random() * 70 });
}
```

### Rate Limiting
```typescript
const MIN_INTERVAL = 30_000; // 30s between comments
let lastAction = 0;

async function rateLimit() {
  const elapsed = Date.now() - lastAction;
  if (elapsed < MIN_INTERVAL) {
    await new Promise(r => setTimeout(r, MIN_INTERVAL - elapsed));
  }
  lastAction = Date.now();
}
```

## 4. Facebook-Specific Patterns

### Profile Switching (Act as Page)
```typescript
// 1. Go to facebook.com
await page.goto("https://www.facebook.com/");

// 2. Click profile menu
await page.locator('[aria-label="โปรไฟล์ของคุณ"]').click();

// 3. "See all profiles"
await page.locator('text=/ดูโปรไฟล์ทั้งหมด/i').click();

// 4. Click page name in dialog (exact match, filter notifications)
const switched = await page.evaluate((name) => {
  const dialogs = document.querySelectorAll('[role="dialog"]');
  for (const dialog of dialogs) {
    const elements = dialog.querySelectorAll('[role="button"]');
    for (const el of elements) {
      const text = el.textContent?.trim() || "";
      // CRITICAL: filter by text length to avoid clicking notifications
      if (text.includes(name) && !text.includes("ติดตาม") && text.length < name.length * 3) {
        el.click();
        return true;
      }
    }
  }
  return false;
}, pageName);
```

### Gotchas
- **Profile switch ต้องทำบน tab เดียวกัน** — cookie ไม่ persist ข้าม tab
- **เช็คก่อนไม่ switch ซ้ำ** — จำ flag `profileSwitched` ต่อ session
- **Notification text มีชื่อเพจปน** — filter ด้วย text length + exclude keywords

### Comment on Post
```typescript
// 1. Open post as FULL PAGE (not popup)
await page.goto(postUrl + "?__cft__[0]=");

// 2. Like first
const likeBtn = page.locator('[aria-label="ถูกใจ"]').first();
if (await likeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  const alreadyLiked = await page.$('[aria-label="เอาถูกใจออก"]');
  if (!alreadyLiked) await likeBtn.click();
}

// 3. Scroll to bottom (comment box at bottom)
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

// 4. Click comment button
await page.locator('[aria-label="แสดงความคิดเห็น"]').click();

// 5. Wait for textbox
await page.waitForSelector('[contenteditable="true"][role="textbox"]', { timeout: 10000 });

// 6. Type + send
await page.keyboard.insertText(commentText);
await page.keyboard.press("Enter");
```

### Scraping Posts
```typescript
// Wait for content, not fixed timeouts
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector('[role="article"]', { timeout: 15000 });

// Top-level posts only (skip nested comments)
const articles = document.querySelectorAll('[role="article"]');
for (const el of articles) {
  if (el.parentElement?.closest('[role="article"]')) continue; // skip nested
  // ... extract data
}

// Comment count: match from footer buttons, not full text
const footerLinks = el.querySelectorAll('a[role="button"]');
for (const fl of footerLinks) {
  const match = fl.textContent?.match(/^(\d+)\s*(ความคิดเห็น|comments?)/i);
  if (match) commentCount = parseInt(match[1]);
}
```

## 5. Live Preview (Screen Streaming)

### CDP Screenshot Loop (15 FPS)
```typescript
const cdp = await context.newCDPSession(page);
const FRAME_MS = 1000 / 15;

while (running) {
  if (!hasClients()) { await sleep(500); continue; } // save CPU
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "jpeg", quality: 20, optimizeForSpeed: true,
  });
  broadcast(Buffer.from(data, "base64")); // binary WebSocket
  await sleep(FRAME_MS);
}
```

### WebSocket Binary Stream (not SSE base64)
```typescript
// Server: broadcast binary JPEG
const wss = new WebSocketServer({ port: 3001 });
wss.on("connection", (ws) => { clients.add(ws); });

function broadcast(buf: Buffer) {
  for (const ws of clients) {
    if (ws.readyState === OPEN && ws.bufferedAmount < 256 * 1024) {
      ws.send(buf); // skip frame if client can't keep up
    }
  }
}

// Client: blob URL → img.src (no React re-render)
ws.onmessage = (e) => {
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = URL.createObjectURL(e.data);
  imgRef.current.src = blobUrl;
};
```

## 6. AI Comment Generation

### Smart Comments
```typescript
// No caption → greeting
if (!postText || postText.length < 10) {
  return randomPick(["สวัสดีครับ", "แวะมาเยี่ยม", "ติดตามแล้วนะ"]);
}

// Has caption → AI analyze
const comment = await claude.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 150,
  messages: [{ role: "user", content: `...${safeText}...` }],
});

// Sanitize inputs
const safeText = postText.slice(0, 500).replace(/"/g, "'");
```

### Comment Priority
1. Custom Comments (user-defined) → random pick
2. AI Generated (from caption) → contextual
3. Greeting (no caption/AI fail) → safe fallback

## 7. Duplicate Prevention

```typescript
// Normalize URL before comparing
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch { return url.split("?")[0]; }
}

// Check DB for previously sent comments
const sent = await db.select({ postUrl: comments.postUrl })
  .where(eq(comments.status, "sent")).all();
const commentedUrls = new Set(sent.map(c => normalizeUrl(c.postUrl)));

// Filter
const newPosts = posts.filter(p => !commentedUrls.has(normalizeUrl(p.url)));
```

## 8. Process Management

### Development
```bash
npm run dev  # concurrently: backend (tsx watch) + frontend (vite)
```

### Production 24hr
```bash
npm run start:24h  # PM2 with auto-restart
npm run stop       # stop
npm run logs       # view logs
```

### PM2 Config
```javascript
module.exports = {
  apps: [{
    name: "page-engager",
    script: "npx tsx src/server/index.ts",
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
    max_memory_restart: "512M",
  }],
};
```

## 9. Common Pitfalls

| Problem | Solution |
|---------|----------|
| Facebook DOM changes | Use multiple selector variants, fallback chain |
| Profile switch clicks notification | Filter by text length + exclude keywords |
| Comment box not found | Open post as full page, scroll to bottom, waitForSelector |
| Thai text typing fails | Use `keyboard.insertText()` instead of `keyboard.type()` |
| CDP "Not attached" | Catch + ignore — page navigating is normal |
| better-sqlite3 + Electron | Use `npmRebuild: false`, server as child process |
| Cross-platform cookie | Detect OS, different Chrome paths |
| Server keeps dying | Use tmux or PM2, not background `&` |
| Git push large files | gitignore release/ dist/ BEFORE first commit |

## 10. Tech Stack Reference

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Tailwind CSS 4 + Vite |
| Backend | Hono + @hono/node-server |
| Database | SQLite + Drizzle ORM |
| Browser | Playwright (Chromium) |
| AI | Claude Haiku (Anthropic API) |
| Preview | CDP screenshot + WebSocket binary |
| Process | PM2 / tmux |
| Build | Electron + electron-builder |
| CI/CD | GitHub Actions |
