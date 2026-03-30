import { chromium, type Browser, type BrowserContext } from "playwright";
import { extractFacebookCookies } from "./extract-cookies";
import { getSetting, setSetting } from "../db/settings";

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let cookiesInjected = false;
let lastCommentTime = 0;
let profileSwitched = false;
let reusablePage: import("playwright").Page | null = null; // shared page for lightweight ops

let HEADLESS = process.env.HEADLESS !== "false"; // default headless — set HEADLESS=false to see browser

export function isHeadless() { return HEADLESS; }
export async function setHeadless(val: boolean) {
  if (HEADLESS === val) return;
  HEADLESS = val;
  await closeBrowser(); // restart browser with new mode on next action
}
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

// Ensure we're browsing as the page — call once, remembers for the session
export async function ensurePageProfile(page: import("playwright").Page): Promise<void> {
  const pageName = getCurrentPage();
  if (!pageName) return;
  if (profileSwitched) return; // already switched this session

  console.log(`[profile] Checking if already on ${pageName}...`);

  // Go to facebook.com to check current profile
  await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check if current profile matches page name
  const isPage = await page.evaluate((name: string) => {
    const imgs = document.querySelectorAll('[aria-label="โปรไฟล์ของคุณ"] img, [aria-label="Your profile"] img');
    for (const img of imgs) {
      if (img.getAttribute("alt")?.includes(name)) return true;
    }
    // Also check meta tag or heading
    const h1 = document.querySelector('h1');
    if (h1?.textContent?.includes(name)) return true;
    return false;
  }, pageName);

  if (isPage) {
    console.log(`[profile] Already on ${pageName}`);
    profileSwitched = true;
    return;
  }

  console.log(`[profile] Switching to ${pageName}...`);
  try {
    await switchProfileOnPage(page, pageName);
    profileSwitched = true;
    console.log(`[profile] Switched to ${pageName}`);
  } catch (e) {
    console.log(`[profile] Switch failed: ${e}`);
  }
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

// Get or create a reusable page for lightweight operations (fetchPageName, listPages)
async function getReusablePage(): Promise<import("playwright").Page> {
  const ctx = await connectToChrome();
  if (reusablePage && !reusablePage.isClosed()) return reusablePage;
  reusablePage = await ctx.newPage();
  return reusablePage;
}

export async function closeBrowser() {
  if (reusablePage) { await reusablePage.close().catch(() => {}); reusablePage = null; }
  if (context) { await context.close().catch(() => {}); context = null; }
  if (browser) { await browser.close().catch(() => {}); browser = null; }
  cookiesInjected = false;
  profileSwitched = false;
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
  const page = await getReusablePage();
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
  } catch (e) {
    // If reusable page broke, clear it
    reusablePage = null;
    throw e;
  }
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
        // Match exact name or name with minimal extra text (< 2x name length)
        // This prevents matching notifications that contain the page name
        if (text.includes(name) && !text.includes("ดูโปรไฟล์") && !text.includes("ติดตาม") && !text.includes("แจ้งเตือน") && text.length < name.length * 3) {
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
    // Don't set as current if switch failed
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
    // Ensure page profile before scanning
    await ensurePageProfile(page);

    emitAction(`Scanning target: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {
      // fallback if networkidle times out — page is probably loaded enough
    });
    // Wait for posts to appear in DOM
    await page.waitForSelector('[role="article"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Switch to "Newest first" / "ใหม่ล่าสุด" sort order
    emitAction("Switching to newest posts first...");
    const sortBtn = page.locator('text=/เกี่ยวข้องมากที่สุด|Most relevant|ยอดนิยม|Top posts/i').first();
    if (await sortBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sortBtn.click();
      await page.waitForTimeout(2000);
      const newestOpt = page.locator('text=/ใหม่ล่าสุด|Newest|Most recent|ล่าสุด/i').first();
      if (await newestOpt.isVisible({ timeout: 5000 }).catch(() => false)) {
        await newestOpt.click();
        // Wait for posts to reload after sort
        await page.waitForTimeout(3000);
        await page.waitForSelector('[role="article"]', { timeout: 10000 }).catch(() => {});
        emitAction("Sorted by newest first");
      }
    }

    emitAction("Reading posts...");
    for (let i = 0; i < 4; i++) {
      // Scroll like a human — variable distance and speed
      const scrollAmount = 600 + Math.floor(Math.random() * 500);
      await page.evaluate((px) => window.scrollBy({ top: px, behavior: "smooth" }), scrollAmount);
      // Human reading time — 3-6 seconds per scroll
      await page.waitForTimeout(3000 + Math.random() * 3000);
    }
    // Pause to "read" like a human
    await page.waitForTimeout(2000 + Math.random() * 2000);
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
          if (t2.match(/^\d+\s*(h|hr|m|min|d|w|ชม|ชั่วโมง|นาที|วัน|สัปดาห์)|^(Yesterday|เมื่อวาน)|^\d+\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)|^(January|February|March|April|May|June|July|August|September|October|November|December)/i)) {
            timestamp = t2; break;
          }
        }
        // Fallback: look for aria-label with time info on links
        if (!timestamp) {
          for (const a of allLinks) {
            const label = a.getAttribute("aria-label") || "";
            if (label.match(/\d{1,2}\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|January|February|March|April|May|June|July|August|September|October|November|December)/i)) {
              timestamp = label.slice(0, 50); break;
            }
          }
        }
        let author = "";
        const strongEl = el.querySelector("strong");
        if (strongEl) author = strongEl.textContent?.trim() || "";

        // Comment count — look for specific elements, not full text
        let commentCount = 0;
        const footerLinks = el.querySelectorAll('a[role="button"], span[role="button"]');
        for (const fl of footerLinks) {
          const ft = fl.textContent?.trim() || "";
          // Match "25 ความคิดเห็น" or "3 comments"
          const cm = ft.match(/^(\d+)\s*(ความคิดเห็น|comments?)/i);
          if (cm) { commentCount = parseInt(cm[1]); break; }
        }

        // Reaction count — look for the reaction bar specifically
        let reactionCount = "";
        const reactionBtns = el.querySelectorAll('[aria-label]');
        for (const rb of reactionBtns) {
          const label = rb.getAttribute("aria-label") || "";
          // Match "15 คน ถูกใจ" or "15 people reacted"
          const rm = label.match(/(\d+[\d,.]*).*?(ถูกใจ|react|like)/i);
          if (rm) { reactionCount = rm[1]; break; }
        }
        if (!reactionCount) {
          for (const fl of footerLinks) {
            const ft = fl.textContent?.trim() || "";
            if (/^\d+$/.test(ft) && parseInt(ft) < 100000) { reactionCount = ft; break; }
          }
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
    // Ensure page profile before commenting
    await ensurePageProfile(page);

    emitAction(`Preparing to comment on post...`);
    await page.waitForTimeout(1000 + Math.random() * 2000);
    // Navigate to post — add ?comment_id= to force full page view (not popup)
    const fullUrl = postUrl.includes("?") ? postUrl : postUrl + "?__cft__[0]=";
    await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000);
    // Close any popup/dialog that might overlay
    const closeBtn = page.locator('[aria-label="ปิด"], [aria-label="Close"]').first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }

    // Scroll down to make comment area visible
    emitAction("Opening comment box...");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Debug: dump all aria-labels and contenteditable elements
    const debugInfo = await page.evaluate(() => {
      const ariaLabels: string[] = [];
      document.querySelectorAll('[aria-label]').forEach((el) => {
        const label = el.getAttribute("aria-label") || "";
        if (label.includes("comment") || label.includes("Comment") || label.includes("ความคิดเห็น") || label.includes("แสดง") || label.includes("เขียน")) {
          ariaLabels.push(`${el.tagName}[aria-label="${label.slice(0, 80)}"] role="${el.getAttribute("role") || ""}" visible=${el.offsetParent !== null}`);
        }
      });
      const editables: string[] = [];
      document.querySelectorAll('[contenteditable="true"]').forEach((el) => {
        editables.push(`${el.tagName} role="${el.getAttribute("role") || ""}" text="${(el.textContent || "").slice(0, 30)}" visible=${el.offsetParent !== null}`);
      });
      return { ariaLabels, editables };
    });
    console.log("[comment] aria-labels:", JSON.stringify(debugInfo.ariaLabels));
    console.log("[comment] editables:", JSON.stringify(debugInfo.editables));

    // Click "แสดงความคิดเห็น" button
    const commentBtn = page.locator('[aria-label="แสดงความคิดเห็น"], [aria-label="Comment"]').first();
    if (await commentBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      emitAction("Clicking comment button...");
      await commentBtn.click();
    }

    // Wait for comment textbox to appear (up to 10s)
    emitAction("Waiting for comment input...");
    const textboxSelector = '[contenteditable="true"][role="textbox"], [data-lexical-editor="true"], [aria-label*="เขียนความคิดเห็น"], [aria-label*="แสดงความคิดเห็นในฐานะ"], [aria-label*="Write a comment"]';
    try {
      await page.waitForSelector(textboxSelector, { timeout: 10000 });
    } catch {
      // Maybe need to scroll down to see comment box
      emitAction("Scrolling to find comment box...");
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(2000);
      try {
        await page.waitForSelector(textboxSelector, { timeout: 5000 });
      } catch {
        throw new Error("Comment textbox not found after scroll");
      }
    }

    // Click the textbox to focus
    const commentBox = page.locator(textboxSelector).first();
    await commentBox.click({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // Type comment — use keyboard.insertText for Thai text (more reliable than type)
    emitAction(`Typing: "${commentText.slice(0, 40)}..."`);
    await page.keyboard.insertText(commentText);
    await page.waitForTimeout(1000);

    // Verify text was entered
    const typed = await page.evaluate(() => {
      const editors = document.querySelectorAll('[contenteditable="true"][role="textbox"], [data-lexical-editor="true"]');
      for (const ed of editors) {
        const text = ed.textContent?.trim();
        if (text && text.length > 2) return text;
      }
      return "";
    });

    if (!typed) {
      emitError("Comment text not entered — retrying with keyboard.type");
      // Retry with character-by-character typing
      for (const char of commentText) {
        await page.keyboard.type(char, { delay: 50 + Math.random() * 50 });
      }
      await page.waitForTimeout(500);
    }

    // Send with Enter
    emitAction("Sending comment...");
    await page.waitForTimeout(500 + Math.random() * 1000);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(4000);

    // Verify comment was posted (check if textbox is empty = sent)
    const afterText = await page.evaluate(() => {
      const editors = document.querySelectorAll('[contenteditable="true"][role="textbox"]');
      for (const ed of editors) {
        const text = ed.textContent?.trim();
        if (text && text.length > 2) return text;
      }
      return "";
    });
    if (afterText) {
      emitAction("Comment might still be in box — trying Ctrl+Enter");
      await page.keyboard.press("Control+Enter");
      await page.waitForTimeout(3000);
    }

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
  const page = await getReusablePage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    const h1 = await page.locator("h1").first().textContent({ timeout: 5000 }).catch(() => null);
    if (h1?.trim()) return h1.trim();
    const title = await page.title();
    const clean = title?.replace(/\s*[|\-—–]\s*Facebook\s*$/i, "").trim();
    if (clean && clean !== "Facebook" && !clean.includes("log in")) return clean;
    throw new Error("Could not extract page name");
  } catch (e) {
    reusablePage = null;
    throw e;
  }
}
