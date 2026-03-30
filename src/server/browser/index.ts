import { chromium, type Browser, type BrowserContext } from "playwright";
import { extractFacebookCookies } from "./extract-cookies";
import { getSetting, setSetting } from "../db/settings";

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let cookiesInjected = false;
let lastCommentTime = 0;

const HEADLESS = process.env.HEADLESS !== "false"; // default headless
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
    await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.locator('[aria-label="โปรไฟล์ของคุณ"], [aria-label="Your profile"]').first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    const seeAll = page.locator('text=/ดูโปรไฟล์ทั้งหมด|See all profiles/i').first();
    if (await seeAll.isVisible({ timeout: 3000 }).catch(() => false)) {
      await seeAll.click();
      await page.waitForTimeout(2000);
    }
    const pageOptions = page.locator(`span:text-is("${pageName}")`);
    const count = await pageOptions.count();
    if (count > 0) {
      await pageOptions.last().click({ force: true, timeout: 5000 });
    } else {
      throw new Error(`Page "${pageName}" not found`);
    }
    await page.waitForTimeout(4000);
    setCurrentPage(pageName);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally { await page.close(); }
}

// --- Scanning ---

export interface ScannedPost { url: string; text: string; author: string; timestamp: string; }

export async function scanTargetPosts(targetUrl: string, limit = 10): Promise<ScannedPost[]> {
  const ctx = await connectToChrome();
  const page = await ctx.newPage();
  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(1000);
    }
    const posts = await page.evaluate((maxPosts: number) => {
      const results: { url: string; text: string; author: string; timestamp: string }[] = [];
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
        if (text || url) {
          results.push({ url: url.startsWith("http") ? url : url ? `https://www.facebook.com${url}` : "", text, author, timestamp });
        }
      }
      return results;
    }, limit);
    return posts;
  } finally { await page.close(); }
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

  const ctx = await connectToChrome();
  const page = await ctx.newPage();
  try {
    // Random delay (human-like)
    await page.waitForTimeout(1000 + Math.random() * 2000);
    await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Open comment box (Reels have a button)
    const commentBtn = page.locator('[aria-label="แสดงความคิดเห็น"], [aria-label="Comment"], [aria-label="Write a comment"]').first();
    if (await commentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commentBtn.click();
      await page.waitForTimeout(2000);
    }

    // Find textbox
    const commentBox = page.locator('[contenteditable="true"][role="textbox"], [aria-label="Write a comment"], [aria-label="เขียนความคิดเห็น"]').first();
    await commentBox.click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Type (human-like speed)
    for (const char of commentText) {
      await page.keyboard.type(char, { delay: 30 + Math.random() * 70 });
    }

    // Send
    await page.waitForTimeout(500);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);

    lastCommentTime = Date.now();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally { await page.close(); }
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
