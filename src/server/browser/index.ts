import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

let browser: Browser | null = null;
let context: BrowserContext | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: false, // visible for semi-auto workflow
      args: ["--disable-blink-features=AutomationControlled"],
    });
  }
  return browser;
}

export async function getContext(cookies?: string): Promise<BrowserContext> {
  const b = await getBrowser();
  if (!context) {
    context = await b.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    if (cookies) {
      const parsed = JSON.parse(cookies);
      await context.addCookies(parsed);
    }
  }
  return context;
}

export async function closeBrowser() {
  if (context) {
    await context.close();
    context = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export interface ScannedPost {
  url: string;
  text: string;
  author: string;
  timestamp: string;
}

export async function scanTargetPosts(
  targetUrl: string,
  cookies: string,
  limit = 10
): Promise<ScannedPost[]> {
  const ctx = await getContext(cookies);
  const page = await ctx.newPage();

  try {
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Scroll to load more posts
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(1000);
    }

    // Extract posts from Facebook page feed
    const posts = await page.evaluate((maxPosts: number) => {
      const results: Array<{
        url: string;
        text: string;
        author: string;
        timestamp: string;
      }> = [];

      // Facebook post containers — these selectors may need updates
      const postElements = document.querySelectorAll(
        '[role="article"], [data-pagelet*="FeedUnit"]'
      );

      for (const el of postElements) {
        if (results.length >= maxPosts) break;

        const textEl = el.querySelector('[data-ad-preview="message"], [data-ad-comet-preview="message"]');
        const text = textEl?.textContent?.trim() || el.querySelector('.x1iorvi4')?.textContent?.trim() || "";

        const linkEl = el.querySelector('a[href*="/posts/"], a[href*="/photo"], a[href*="story_fbid"]');
        const url = linkEl?.getAttribute("href") || "";

        const timeEl = el.querySelector("abbr, [data-utime], span.timestampContent");
        const timestamp = timeEl?.textContent?.trim() || "";

        if (text || url) {
          results.push({
            url: url.startsWith("http") ? url : `https://www.facebook.com${url}`,
            text: text.slice(0, 500),
            author: "",
            timestamp,
          });
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
  commentText: string,
  cookies: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getContext(cookies);
  const page = await ctx.newPage();

  try {
    // Random delay 1-3s before action
    await page.waitForTimeout(1000 + Math.random() * 2000);

    await page.goto(postUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click comment input area
    const commentBox = page.locator(
      '[aria-label="Write a comment"], [aria-label="เขียนความคิดเห็น"], [contenteditable="true"][role="textbox"]'
    );
    await commentBox.first().click();
    await page.waitForTimeout(500);

    // Type comment with human-like delay
    for (const char of commentText) {
      await page.keyboard.type(char, { delay: 30 + Math.random() * 70 });
    }

    await page.waitForTimeout(500);

    // Press Enter to send
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

export async function openLoginPage(): Promise<string> {
  const ctx = await getContext();
  const page = await ctx.newPage();
  await page.goto("https://www.facebook.com", { waitUntil: "networkidle" });
  return "Login page opened. Please login manually, then use /api/sessions/capture to save cookies.";
}

export async function captureCookies(): Promise<string> {
  if (!context) throw new Error("No browser context. Open login page first.");
  const cookies = await context.cookies(["https://www.facebook.com"]);
  return JSON.stringify(cookies);
}
