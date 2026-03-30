import { connectToChrome } from "./index";

export interface DiscoveredProfile {
  name: string;
  url: string;
  interactionCount: number;
  lastSeen: string;
}

// Scan our own page's recent posts and collect people who commented/reacted
export async function discoverEngagers(myPageUrl: string, postsToScan = 5): Promise<DiscoveredProfile[]> {
  const ctx = await connectToChrome();
  const page = await ctx.newPage();

  try {
    await page.goto(myPageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Scroll to load posts
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(1000);
    }

    // Collect commenter profiles from visible posts
    const engagers = await page.evaluate((maxPosts: number) => {
      const profileMap = new Map<string, { name: string; url: string; count: number }>();

      const articles = document.querySelectorAll('[role="article"]');
      let postCount = 0;

      for (const article of articles) {
        // Skip nested articles (comments inside posts)
        if (article.parentElement?.closest('[role="article"]')) continue;
        if (postCount >= maxPosts) break;
        postCount++;

        // Find all profile links in this post's comments
        const links = article.querySelectorAll('a[href*="/profile.php"], a[href*="facebook.com/"]');
        for (const link of links) {
          const href = link.getAttribute("href") || "";
          const name = link.textContent?.trim() || "";

          // Filter: must be a profile link, have a name, not our own page
          if (!name || name.length < 2 || name.length > 60) continue;
          if (href.includes("/pages/") || href.includes("/settings") || href.includes("/help")) continue;
          if (name.includes("คิดดี") || name.includes("มาร่าง") || name.includes("Wownew")) continue; // skip our own pages

          // Extract clean profile URL
          let profileUrl = href.split("?")[0];
          if (!profileUrl.startsWith("http")) profileUrl = `https://www.facebook.com${profileUrl}`;
          if (!profileUrl.includes("facebook.com/")) continue;

          const key = profileUrl;
          const existing = profileMap.get(key);
          if (existing) {
            existing.count++;
          } else {
            profileMap.set(key, { name, url: profileUrl, count: 1 });
          }
        }
      }

      return Array.from(profileMap.values())
        .sort((a, b) => b.count - a.count);
    }, postsToScan);

    return engagers.map((e) => ({
      name: e.name,
      url: e.url,
      interactionCount: e.count,
      lastSeen: new Date().toISOString(),
    }));
  } finally {
    await page.close();
  }
}
