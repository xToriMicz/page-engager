import { chromium, type Browser, type BrowserContext } from "playwright";
import { extractFacebookCookies } from "./extract-cookies";
import { getSetting, setSetting } from "../db/settings";

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let cookiesInjected = false;
let lastCommentTime = 0;

const HEADLESS = process.env.HEADLESS === "true"; // default visible — see browser work in real-time
const CHROME_PROFILE = process.env.CHROME_PROFILE || "Profile 8";
const MIN_COMMENT_INTERVAL = 30_000; // 30 seconds between comments

// --- Connection ---

export async function connectToChrome(): Promise<BrowserContext> {
  if (context && browser?.isConnected()) return context;
  await closeBrowser();

  browser = await chromium.launch({
    headless: HEADLESS,
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run"],
  });

  context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  if (!cookiesInjected) {
    const cookies = extractFacebookCookies(CHROME_PROFILE);
    if (cookies.length > 0) {
      await context.addCookies(cookies);
      cookiesInjected = true;
      console.log(`Injected ${cookies.length} cookies from Chrome ${CHROME_PROFILE}`);
    }
  }

  return context;
}

export async function isConnected(): Promise<boolean> {
  return browser?.isConnected() ?? false;
}

export async function getChromeInfo() {
  return {
    browser: browser?.isConnected() ? `Chromium ${HEADLESS ? "(headless)" : "(visible)"} — ${CHROME_PROFILE}` : "",
    connected: browser?.isConnected() ?? false,
    currentPage: getCurrentPage(),
  };
}

export async function closeBrowser() {
  if (context) { await context.close().catch(() => {}); context = null; }
  if (browser) { await browser.close().catch(() => {}); browser = null; }
  cookiesInjected = false;
}

// --- Page Switching (persisted) ---

export interface ManagedPage { name: string; url: string; }

export function getCurrentPage(): string | null {
  return getSetting("currentPage");
}

function setCurrentPage(name: string) {
  setSetting("currentPage", name);
}

export async function listManagedPages(): Promise<ManagedPage[]> {
  const ctx = await connectToChrome();
  const page = await ctx.newPage();
  try {
    await page.goto("https://www.facebook.com/pages/?category=your_pages", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    const pages = await page.evaluate(() => {
      const results: { name: string; url: string }[] = [];
      const links = document.querySelectorAll('a[href*="/profile.php"], a[href*="facebook.com/"]');
      const seen = new Set<string>();
      for (const a of links) {
        const name = a.textContent?.trim() || "";
        const href = a.getAttribute("href") || "";
        if (name && name.length > 1 && name.length < 100 && href.includes("facebook.com") && !seen.has(name)) {
          if (href.includes("/profile.php?id=") || (!href.includes("/pages") && !href.includes("/settings") && !href.includes("/help"))) {
            seen.add(name);
            results.push({ name, url: href.startsWith("http") ? href : `https://www.facebook.com${href}` });
          }
        }
      }
      return results;
    });
    return pages;
  } finally { await page.close(); }
}

export async function switchToPage(pageName: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await connectToChrome();
  const page = await ctx.newPage();
  try {
    await switchProfileOnPage(page, pageName);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally { await page.close(); }
}

// Switch profile on an EXISTING page object (same tab) — use this for discover/scan
export async function switchProfileOnPage(page: import("playwright").Page, pageName: string): Promise<void> {
  // Method 1: Use account switcher menu
  await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Click account menu (top right avatar)
  const accountMenu = page.locator('[aria-label="บัญชีของคุณ"], [aria-label="Your account"], [aria-label="Account"], [aria-label="เมนูบัญชี"], [aria-label="Account menu"]').first();
  const profileMenu = page.locator('[aria-label="โปรไฟล์ของคุณ"], [aria-label="Your profile"]').first();

  // Try account menu first, then profile menu
  if (await accountMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
    await accountMenu.click();
  } else {
    await profileMenu.click({ timeout: 5000 });
  }
  await page.waitForTimeout(2000);

  // Debug: dump all visible text in the menu to see what's available
  const menuDebug = await page.evaluate(() => {
    const dialogs = document.querySelectorAll('[role="dialog"], [role="menu"], [role="listbox"]');
    const texts: string[] = [];
    for (const d of dialogs) {
      d.querySelectorAll('span, a, [role="button"]').forEach((el) => {
        const t = el.textContent?.trim();
        if (t && t.length > 1 && t.length < 80) texts.push(t);
      });
    }
    // Also check general visible buttons/links
    document.querySelectorAll('[role="button"], a').forEach((el) => {
      const t = el.textContent?.trim();
      if (t && t.includes("สลับ") || t?.includes("Switch") || t?.includes("โปรไฟล์") || t?.includes("profile")) {
        texts.push(`[btn] ${t?.slice(0, 60)}`);
      }
    });
    return texts.slice(0, 30);
  });
  console.log(`[switch] Menu items:`, JSON.stringify(menuDebug, null, 0));

  // Look for "ดูโปรไฟล์ทั้งหมด" → opens "เลือกโปรไฟล์" dialog
  const seeAll = page.locator('text=/ดูโปรไฟล์ทั้งหมด|See all profiles/i').first();
  if (await seeAll.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log(`[switch] Found "See all profiles" — clicking`);
    await seeAll.click();
    await page.waitForTimeout(3000);
  }

  // Wait for "เลือกโปรไฟล์" dialog
  await page.waitForTimeout(2000);

  // In the profile selection dialog, find the clickable row for the page
  // Facebook renders each profile as a clickable div with role and the page name
  // We need to click the ROW that contains the page name, not just the text
  const switched = await page.evaluate((name: string) => {
    // Find the "เลือกโปรไฟล์" dialog
    const dialogs = document.querySelectorAll('[role="dialog"]');
    for (const dialog of dialogs) {
      // Find all clickable elements that contain the page name
      const elements = dialog.querySelectorAll('[role="radio"], [role="option"], [role="button"], [tabindex="0"]');
      for (const el of elements) {
        const text = el.textContent?.trim() || "";
        if (text.includes(name) && !text.includes("ดูโปรไฟล์") && text.length < 100) {
          // This is the profile row — click it
          (el as HTMLElement).click();
          return `Clicked element with role="${el.getAttribute("role")}" text="${text.slice(0, 50)}"`;
        }
      }

      // Fallback: find any div that has the page name and seems clickable
      const allSpans = dialog.querySelectorAll('span');
      for (const span of allSpans) {
        if (span.textContent?.trim() === name) {
          // Walk up to find clickable parent
          let parent = span.parentElement;
          for (let i = 0; i < 5 && parent; i++) {
            const role = parent.getAttribute("role");
            const tabindex = parent.getAttribute("tabindex");
            if (role === "radio" || role === "option" || role === "button" || tabindex === "0") {
              (parent as HTMLElement).click();
              return `Clicked parent with role="${role}" tabindex="${tabindex}"`;
            }
            parent = parent.parentElement;
          }
          // Last resort: click the span's closest interactive ancestor
          const closest = span.closest('[role="radio"], [role="option"], [role="button"], [tabindex="0"], a');
          if (closest) {
            (closest as HTMLElement).click();
            return `Clicked closest interactive: ${closest.tagName} role="${closest.getAttribute("role")}"`;
          }
        }
      }
    }
    return null;
  }, pageName);

  if (switched) {
    console.log(`[switch] ${switched}`);
    // Wait for Facebook to process the switch (page reload/redirect)
    await page.waitForTimeout(5000);
    // Verify
    const currentUrl = page.url();
    console.log(`[switch] After switch URL: ${currentUrl}`);
    setCurrentPage(pageName);
  } else {
    console.log(`[switch] Warning: could not find clickable element for ${pageName}`);
    setCurrentPage(pageName);
  }
}

// --- Scanning ---

export interface ScannedPost {
  url: string;
  text: string;
  author: string;
  timestamp: string;
  commentCount: number;
  hasImage: boolean;
  hasVideo: boolean;
  reactionCount: string;
}

export async function scanTargetPosts(targetUrl: string, limit = 10): Promise<ScannedPost[]> {
  const { emitAction, emitDone, setPreviewActive, startScreencast } = await import("./preview");
  setPreviewActive(true);
  const ctx = await connectToChrome();
  const page = await ctx.newPage();
  const stopCapture = await startScreencast(page);
  try {
    emitAction(`Scanning target: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    emitAction("Scrolling to load posts...");
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(1000);
    }
    const posts = await page.evaluate((maxPosts: number) => {
      const results: { url: string; text: string; author: string; timestamp: string; commentCount: number; hasImage: boolean; hasVideo: boolean; reactionCount: string }[] = [];
      const allArticles = document.querySelectorAll('[role="article"]');
      const articles: Element[] = [];
      for (const el of allArticles) {
        if (!el.parentElement?.closest('[role="article"]')) articles.push(el);
      }
      for (const el of articles) {
        if (results.length >= maxPosts) break;
        const textParts: string[] = [];
        el.querySelectorAll('div[dir="auto"]').forEach((d) => {
          const t = d.textContent?.trim();
          if (t && t.length > 10 && !t.startsWith("Like") && !t.startsWith("Comment")) textParts.push(t);
        });
        const text = textParts.join("\n").slice(0, 500);
        let url = "";
        const allLinks = el.querySelectorAll("a[href]");
        for (const a of allLinks) {
          const href = a.getAttribute("href") || "";
          if (/\/posts\/|\/photos\/|\/videos\/|story_fbid|\/permalink\/|\/reel\//.test(href)) { url = href; break; }
        }
        let timestamp = "";
        for (const a of allLinks) {
          const t2 = a.textContent?.trim() || "";
          if (t2.match(/^\d+\s*(h|hr|m|min|d|w|ชม|นาที|วัน|สัปดาห์)|^(Yesterday|เมื่อวาน)/i)) { timestamp = t2; break; }
        }
        let author = "";
        const strongEl = el.querySelector("strong");
        if (strongEl) author = strongEl.textContent?.trim() || "";

        // Comment count
        let commentCount = 0;
        const allText = el.textContent || "";
        const commentMatch = allText.match(/(\d+)\s*(ความคิดเห็น|comments?)/i);
        if (commentMatch) commentCount = parseInt(commentMatch[1]);

        // Reaction count
        let reactionCount = "";
        const reactionEl = el.querySelector('[aria-label*="reaction"], [aria-label*="ถูกใจ"], [aria-label*="like"]');
        if (reactionEl) reactionCount = reactionEl.textContent?.trim() || "";
        if (!reactionCount) {
          const rcMatch = allText.match(/(\d+[\d,.]*)\s*(ถูกใจ|likes?)/i);
          if (rcMatch) reactionCount = rcMatch[1];
        }

        // Media type
        const hasImage = el.querySelectorAll('img[src*="scontent"], img[src*="fbcdn"]').length > 1;
        const hasVideo = el.querySelectorAll('video, [aria-label*="video"], [aria-label*="วิดีโอ"], [data-video-id]').length > 0;

        if (text || url) {
          results.push({
            url: url.startsWith("http") ? url : url ? `https://www.facebook.com${url}` : "",
            text, author, timestamp, commentCount, hasImage, hasVideo, reactionCount,
          });
        }
      }
      return results;
    }, limit);
    emitDone(`Scan complete — found ${posts.length} posts`);
    return posts;
  } finally { stopCapture(); setPreviewActive(false); await page.close(); }
}

// --- Commenting (with rate limit) ---

export async function sendComment(postUrl: string, commentText: string): Promise<{ success: boolean; error?: string }> {
  // Rate limit
  const now = Date.now();
  const timeSince = now - lastCommentTime;
  if (timeSince < MIN_COMMENT_INTERVAL) {
    const wait = MIN_COMMENT_INTERVAL - timeSince;
    console.log(`Rate limit: waiting ${Math.ceil(wait / 1000)}s`);
    await new Promise((r) => setTimeout(r, wait));
  }

  const { emitAction, emitDone, emitError, setPreviewActive, startScreencast } = await import("./preview");
  setPreviewActive(true);
  const ctx = await connectToChrome();
  const page = await ctx.newPage();
  const stopCapture = await startScreencast(page);
  try {
    emitAction(`Preparing to comment on post...`);
    await page.waitForTimeout(1000 + Math.random() * 2000);
    await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Open comment box
    emitAction("Opening comment box...");
    const commentBtn = page.locator('[aria-label="แสดงความคิดเห็น"], [aria-label="Comment"], [aria-label="Write a comment"]').first();
    if (await commentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commentBtn.click();
      await page.waitForTimeout(2000);
    }

    // Find textbox
    const commentBox = page.locator('[contenteditable="true"][role="textbox"], [aria-label="Write a comment"], [aria-label="เขียนความคิดเห็น"]').first();
    await commentBox.click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Type
    emitAction(`Typing comment: "${commentText.slice(0, 50)}..."`);
    for (const char of commentText) {
      await page.keyboard.type(char, { delay: 30 + Math.random() * 70 });
    }

    // Send
    emitAction("Sending comment...");
    await page.waitForTimeout(500);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);

    lastCommentTime = Date.now();
    emitDone("Comment sent successfully");
    return { success: true };
  } catch (error) {
    emitError(`Comment failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally { stopCapture(); setPreviewActive(false); await page.close(); }
}

// --- Fetch page name ---

export async function fetchPageName(url: string): Promise<string> {
  const ctx = await connectToChrome();
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    const h1 = await page.locator("h1").first().textContent({ timeout: 5000 }).catch(() => null);
    if (h1?.trim()) return h1.trim();
    const title = await page.title();
    const clean = title?.replace(/\s*[|\-—–]\s*Facebook\s*$/i, "").trim();
    if (clean && clean !== "Facebook" && !clean.includes("log in")) return clean;
    throw new Error("Could not extract page name");
  } finally { await page.close(); }
}
