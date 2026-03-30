import { chromium, type Browser, type BrowserContext } from "playwright";
import { extractFacebookCookies } from "./extract-cookies";

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let cookiesInjected = false;

// Launch browser + inject cookies from Chrome main profile
export async function connectToChrome(): Promise<BrowserContext> {
  if (context && browser?.isConnected()) return context;

  // Close old
  await closeBrowser();

  browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
    ],
  });

  context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  // Inject cookies from Chrome main profile
  if (!cookiesInjected) {
    const cookies = extractFacebookCookies();
    if (cookies.length > 0) {
      await context.addCookies(cookies);
      cookiesInjected = true;
      console.log(`Injected ${cookies.length} Facebook cookies from Chrome`);
    } else {
      console.warn("No Facebook cookies found in Chrome profile");
    }
  }

  return context;
}

export async function isConnected(): Promise<boolean> {
  return browser?.isConnected() ?? false;
}

export async function getChromeInfo(): Promise<{ browser: string; connected: boolean }> {
  const connected = browser?.isConnected() ?? false;
  return {
    browser: connected ? `Chromium (${cookiesInjected ? "cookies injected" : "no cookies"})` : "",
    connected,
  };
}

export async function closeBrowser() {
  if (context) {
    await context.close().catch(() => {});
    context = null;
  }
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
  cookiesInjected = false;
}

// --- Page switching ---

export interface ManagedPage {
  name: string;
  url: string;
}

let currentPageName: string | null = null;

export async function listManagedPages(): Promise<ManagedPage[]> {
  const ctx = await connectToChrome();
  const page = await ctx.newPage();

  try {
    await page.goto("https://www.facebook.com/pages/?category=your_pages", {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.waitForTimeout(3000);

    const pages = await page.evaluate(() => {
      const results: { name: string; url: string }[] = [];
      // Find page cards/links
      const links = document.querySelectorAll('a[href*="/profile.php"], a[href*="facebook.com/"]');
      const seen = new Set<string>();
      for (const a of links) {
        const name = a.textContent?.trim() || "";
        const href = a.getAttribute("href") || "";
        if (name && name.length > 1 && name.length < 100 && href.includes("facebook.com") && !seen.has(name)) {
          // Filter out non-page links
          if (href.includes("/profile.php?id=") || (!href.includes("/pages") && !href.includes("/settings") && !href.includes("/help"))) {
            seen.add(name);
            results.push({ name, url: href.startsWith("http") ? href : `https://www.facebook.com${href}` });
          }
        }
      }
      return results;
    });

    return pages;
  } finally {
    await page.close();
  }
}

export async function switchToPage(pageName: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await connectToChrome();
  const page = await ctx.newPage();

  try {
    // Go to Facebook home
    await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Step 1: Click profile avatar (top right)
    await page.locator('[aria-label="โปรไฟล์ของคุณ"], [aria-label="Your profile"]').first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);

    // Step 2: Look for "ดูโปรไฟล์ทั้งหมด" / "See all profiles" and click it
    const seeAll = page.locator('text=/ดูโปรไฟล์ทั้งหมด|See all profiles/i').first();
    const hasSeeAll = await seeAll.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasSeeAll) {
      await seeAll.click();
      await page.waitForTimeout(2000);
    }

    // Step 3: Click the target page name in the profile switcher section
    // The page names appear as visible, clickable spans BELOW "ดูโปรไฟล์ทั้งหมด"
    // Use force:true since FB hides elements weirdly
    const pageOptions = page.locator(`span:text-is("${pageName}")`);
    const count = await pageOptions.count();
    console.log(`Found ${count} elements matching "${pageName}"`);

    // Click the LAST match — the one in the profile switcher section (not notifications)
    if (count > 0) {
      await pageOptions.last().click({ force: true, timeout: 5000 });
    } else {
      throw new Error(`Page "${pageName}" not found in profile menu`);
    }
    await page.waitForTimeout(4000);

    // Verify: check if the textbox now says "commenting as [pageName]"
    const title = await page.title();
    console.log(`Switched to ${pageName}, page title: ${title}`);

    currentPageName = pageName;
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

export function getCurrentPage(): string | null {
  return currentPageName;
}

// --- Scanning ---

export interface ScannedPost {
  url: string;
  text: string;
  author: string;
  timestamp: string;
}

export async function scanTargetPosts(
  targetUrl: string,
  limit = 10
): Promise<ScannedPost[]> {
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
      const results: Array<{
        url: string;
        text: string;
        author: string;
        timestamp: string;
      }> = [];

      // Get top-level articles (posts, not comments)
      const allArticles = document.querySelectorAll('[role="article"]');
      const articles: Element[] = [];
      for (const el of allArticles) {
        const parentArticle = el.parentElement?.closest('[role="article"]');
        if (!parentArticle) articles.push(el);
      }

      for (const el of articles) {
        if (results.length >= maxPosts) break;

        // Post text
        const textParts: string[] = [];
        el.querySelectorAll('div[dir="auto"]').forEach((d) => {
          const t = d.textContent?.trim();
          if (t && t.length > 10 && !t.startsWith("Like") && !t.startsWith("Comment")) {
            textParts.push(t);
          }
        });
        const text = textParts.join("\n").slice(0, 500);

        // Post permalink
        let url = "";
        const allLinks = el.querySelectorAll("a[href]");
        for (const a of allLinks) {
          const href = a.getAttribute("href") || "";
          if (
            href.includes("/posts/") ||
            href.includes("/photos/") ||
            href.includes("/videos/") ||
            href.includes("story_fbid") ||
            href.includes("/permalink/") ||
            href.includes("/reel/")
          ) {
            url = href;
            break;
          }
        }

        // Timestamp
        let timestamp = "";
        for (const a of allLinks) {
          const t2 = a.textContent?.trim() || "";
          const href = a.getAttribute("href") || "";
          if (t2.match(/^\d+\s*(h|hr|m|min|d|w|ชม|นาที|วัน|สัปดาห์)|^(Yesterday|เมื่อวาน|March|April|มี\.ค\.|เม\.ย\.)/i)) {
            timestamp = t2;
            if (!url && (href.includes("/posts/") || href.includes("story_fbid") || href.includes("/permalink/"))) {
              url = href;
            }
            break;
          }
        }

        // Author
        let author = "";
        const strongEl = el.querySelector("strong");
        if (strongEl) author = strongEl.textContent?.trim() || "";

        if (text || url) {
          const fullUrl = url.startsWith("http")
            ? url
            : url
              ? `https://www.facebook.com${url}`
              : "";
          results.push({ url: fullUrl, text, author, timestamp });
        }
      }

      return results;
    }, limit);

    return posts;
  } finally {
    await page.close();
  }
}

export async function sendComment(
  postUrl: string,
  commentText: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await connectToChrome();
  const page = await ctx.newPage();

  try {
    await page.waitForTimeout(1000 + Math.random() * 2000);
    await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Step 1: If a page is selected, try to switch "commenting as" to that page
    if (currentPageName) {
      // Look for the profile avatar/switcher near comment box
      // FB shows a small avatar you can click to change "commenting as"
      const commentAsBtn = page.locator(
        '[aria-label*="Comment as"], [aria-label*="แสดงความคิดเห็นในฐานะ"]'
      ).first();
      const hasCommentAs = await commentAsBtn.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasCommentAs) {
        await commentAsBtn.click();
        await page.waitForTimeout(1000);
        // Click the page name in the dropdown
        const pageOption = page.locator(`text="${currentPageName}"`).first();
        const hasOption = await pageOption.isVisible({ timeout: 2000 }).catch(() => false);
        if (hasOption) {
          await pageOption.click();
          await page.waitForTimeout(1000);
          console.log(`Switched commenting as: ${currentPageName}`);
        }
      }
    }

    // Step 2: Open comment box (Reels have a button, regular posts have textbox)
    // Try clicking "Comment" button first (Reels)
    const commentBtn = page.locator(
      '[aria-label="แสดงความคิดเห็น"], [aria-label="Comment"], [aria-label="Write a comment"]'
    ).first();
    const hasBtnVisible = await commentBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasBtnVisible) {
      await commentBtn.click();
      await page.waitForTimeout(2000);
    }

    // Now find the actual textbox
    const commentBox = page.locator(
      '[contenteditable="true"][role="textbox"], [aria-label="Write a comment"], [aria-label="เขียนความคิดเห็น"], [aria-placeholder*="comment"], [aria-placeholder*="ความคิดเห็น"]'
    ).first();
    await commentBox.click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Step 3: Type comment (human-like speed)
    for (const char of commentText) {
      await page.keyboard.type(char, { delay: 30 + Math.random() * 70 });
    }

    // Step 4: Send
    await page.waitForTimeout(500);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

export async function fetchPageName(url: string): Promise<string> {
  const ctx = await connectToChrome();
  const page = await ctx.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    const h1 = await page.locator("h1").first().textContent({ timeout: 5000 }).catch(() => null);
    if (h1?.trim()) return h1.trim();

    const title = await page.title();
    if (title) {
      const clean = title.replace(/\s*[|\-—–]\s*Facebook\s*$/i, "").trim();
      if (clean && clean !== "Facebook" && !clean.includes("log in")) return clean;
    }

    const ogTitle = await page.evaluate(() => {
      const el = document.querySelector('meta[property="og:title"]');
      return el?.getAttribute("content") || "";
    }).catch(() => "");
    if (ogTitle?.trim()) return ogTitle.trim();

    throw new Error("Could not extract page name");
  } finally {
    await page.close();
  }
}
