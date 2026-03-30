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
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
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
    await page.goto(postUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const commentBox = page.locator(
      '[aria-label="Write a comment"], [aria-label="เขียนความคิดเห็น"], [contenteditable="true"][role="textbox"]'
    );
    await commentBox.first().click();
    await page.waitForTimeout(500);

    for (const char of commentText) {
      await page.keyboard.type(char, { delay: 30 + Math.random() * 70 });
    }

    await page.waitForTimeout(500);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

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
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
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
