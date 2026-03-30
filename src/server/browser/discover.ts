import { connectToChrome, ensurePageProfile } from "./index";
import { emitAction, emitStatus, emitDone, emitError, setPreviewActive, startScreencast } from "./preview";

export interface DiscoveredProfile {
  name: string;
  url: string;
  interactionCount: number;
  lastSeen: string;
}

function randomDelay(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Scan our own page's recent posts and collect people who commented
export async function discoverEngagers(myPageUrl: string, postsToScan = 5): Promise<DiscoveredProfile[]> {
  setPreviewActive(true);
  emitStatus("Starting discover...");

  const ctx = await connectToChrome();
  const page = await ctx.newPage();

  // CDP Screencast — real-time stream from Chrome
  const stopCapture = await startScreencast(page);

  try {
    // Ensure page profile before discovering
    emitAction("Checking profile...");
    await ensurePageProfile(page);

    emitAction(`Opening page: ${myPageUrl}`);
    await page.goto(myPageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Scroll to load posts
    emitAction("Scrolling to load posts...");
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 800 + Math.random() * 600));
      await page.waitForTimeout(randomDelay(1500, 3000));
    }
    // screencast handles continuous capture

    // Step 1: Collect post URLs
    const postUrls = await page.evaluate((maxPosts: number) => {
      const urls: string[] = [];
      const allArticles = document.querySelectorAll('[role="article"]');
      for (const el of allArticles) {
        if (el.parentElement?.closest('[role="article"]')) continue;
        if (urls.length >= maxPosts) break;
        const allLinks = el.querySelectorAll("a[href]");
        for (const a of allLinks) {
          const href = a.getAttribute("href") || "";
          if (/\/posts\/|story_fbid|\/permalink\/|\/photos\/|\/videos\/|\/reel\//.test(href)) {
            const fullUrl = href.startsWith("http") ? href : `https://www.facebook.com${href}`;
            urls.push(fullUrl.split("?")[0]);
            break;
          }
        }
      }
      return urls;
    }, postsToScan);

    emitAction(`Found ${postUrls.length} posts to scan`);

    // Step 2: Visit each post and collect commenters
    const profileMap = new Map<string, { name: string; url: string; count: number }>();

    for (let idx = 0; idx < postUrls.length; idx++) {
      const postUrl = postUrls[idx];
      try {
        if (idx > 0) {
          const delay = randomDelay(5000, 10000);
          emitStatus(`Waiting ${Math.round(delay / 1000)}s before next post...`);
          await page.waitForTimeout(delay);
        }

        emitAction(`Opening post ${idx + 1}/${postUrls.length}`);
        await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(randomDelay(3000, 5000));
        // screencast handles continuous capture

        // Expand comments
        emitAction("Expanding comments...");
        for (let attempt = 0; attempt < 3; attempt++) {
          const moreBtn = page.locator('[role="button"]:has-text("ดูความคิดเห็นเพิ่มเติม"), [role="button"]:has-text("View more comments"), [role="button"]:has-text("ความคิดเห็นก่อนหน้า"), [role="button"]:has-text("Previous comments")').first();
          if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await moreBtn.click().catch(() => {});
            await page.waitForTimeout(randomDelay(2000, 4000));
            // screencast handles continuous capture
          } else {
            break;
          }
        }

        // Scroll for more comments
        await page.evaluate(() => window.scrollBy(0, 1500 + Math.random() * 1000));
        await page.waitForTimeout(randomDelay(2000, 3000));
        // screencast handles continuous capture

        // Extract commenters
        const commenters = await page.evaluate(() => {
          const results: { name: string; url: string }[] = [];
          const articles = document.querySelectorAll('[role="article"]');
          for (const article of articles) {
            if (!article.parentElement?.closest('[role="article"]')) continue;
            const links = article.querySelectorAll('a[href]');
            for (const link of links) {
              const href = link.getAttribute("href") || "";
              const name = link.textContent?.trim() || "";
              if (!name || name.length < 2 || name.length > 60) continue;
              if (!href.includes("facebook.com") && !href.includes("/profile.php")) continue;
              if (href.includes("/hashtag/") || href.includes("/posts/") || href.includes("/photos/") || href.includes("/videos/") || href.includes("/reel/") || href.includes("story_fbid") || href.includes("/permalink/") || href.includes("/pages/") || href.includes("/settings") || href.includes("/help") || href.includes("/groups/")) continue;
              if (name.match(/^\d+\s*(ชั่วโมง|นาที|วัน|สัปดาห์|h|m|d|w|hr|min)/)) continue;
              if (name.startsWith("#")) continue;
              if (name.match(/^(ตอบกลับ|Reply|ถูกใจ|Like|แชร์|Share|ดูเพิ่มเติม|See more|แก้ไขแล้ว|Edited)$/i)) continue;

              let profileUrl = href;
              if (href.includes("profile.php")) {
                const idMatch = href.match(/profile\.php\?id=(\d+)/);
                profileUrl = idMatch ? `https://www.facebook.com/profile.php?id=${idMatch[1]}` : href.split("&")[0];
              } else {
                profileUrl = href.split("?")[0];
              }
              if (!profileUrl.startsWith("http")) profileUrl = `https://www.facebook.com${profileUrl}`;
              if (!/facebook\.com\/(profile\.php\?id=\d+|[a-zA-Z0-9.]+)\/?$/.test(profileUrl)) continue;

              results.push({ name, url: profileUrl });
              break;
            }
          }
          return results;
        });

        emitAction(`Post ${idx + 1}: found ${commenters.length} commenters`);

        for (const c of commenters) {
          const existing = profileMap.get(c.url);
          if (existing) {
            existing.count++;
            if (c.name.length > existing.name.length) existing.name = c.name;
          } else {
            profileMap.set(c.url, { name: c.name, url: c.url, count: 1 });
          }
        }
      } catch (e) {
        emitError(`Error scanning post ${idx + 1}: ${e}`);
      }
    }

    const engagers = Array.from(profileMap.values())
      .filter((e) => !e.name.includes("คิดดี") && !e.name.includes("มาร่าง") && !e.name.includes("Wownew"))
      .sort((a, b) => b.count - a.count);

    emitDone(`Done — ${engagers.length} unique engagers from ${postUrls.length} posts`);

    return engagers.map((e) => ({
      name: e.name,
      url: e.url,
      interactionCount: e.count,
      lastSeen: new Date().toISOString(),
    }));
  } catch (e) {
    emitError(`Fatal error: ${e}`);
    throw e;
  } finally {
    stopCapture();
    setPreviewActive(false);
    await page.close();
  }
}
