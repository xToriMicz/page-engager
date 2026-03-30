import { Database } from "bun:sqlite";
import { execSync } from "child_process";
import { existsSync, copyFileSync, mkdirSync, readFileSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CHROME_DIR = join(homedir(), "Library/Application Support/Google/Chrome");

export interface ChromeProfile {
  dir: string;       // "Profile 10"
  name: string;      // "Angkana"
  account: string;   // "Angkana Bunchoom"
  hasCookies: boolean;
}

export function listChromeProfiles(): ChromeProfile[] {
  if (!existsSync(CHROME_DIR)) return [];

  const entries = readdirSync(CHROME_DIR, { withFileTypes: true });
  const profiles: ChromeProfile[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Chrome profiles: "Default", "Profile 1", "Profile 2", etc.
    if (entry.name !== "Default" && !entry.name.startsWith("Profile ")) continue;

    const prefPath = join(CHROME_DIR, entry.name, "Preferences");
    if (!existsSync(prefPath)) continue;

    try {
      const prefs = JSON.parse(readFileSync(prefPath, "utf-8"));
      const profileData = prefs.profile || {};
      const accountInfo = prefs.account_info?.[0] || {};

      profiles.push({
        dir: entry.name,
        name: profileData.name || entry.name,
        account: accountInfo.full_name || profileData.gaia_given_name || "",
        hasCookies: existsSync(join(CHROME_DIR, entry.name, "Cookies")),
      });
    } catch {
      // skip broken profiles
    }
  }

  return profiles.filter((p) => p.hasCookies);
}

function getChromeEncryptionKey(): Buffer {
  const raw = execSync(
    `security find-generic-password -w -s "Chrome Safe Storage" -a "Chrome"`,
    { encoding: "utf-8" }
  ).trim();
  const crypto = require("crypto");
  return crypto.pbkdf2Sync(raw, "saltysalt", 1003, 16, "sha1");
}

function decryptCookieValue(encryptedValue: Buffer, key: Buffer): string {
  if (encryptedValue.length === 0) return "";

  // Chrome cookies on macOS start with "v10" prefix (3 bytes)
  if (
    encryptedValue[0] === 0x76 &&
    encryptedValue[1] === 0x31 &&
    encryptedValue[2] === 0x30
  ) {
    const crypto = require("crypto");
    const iv = Buffer.alloc(16, " "); // 16 spaces
    const data = encryptedValue.slice(3);
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
    decipher.setAutoPadding(true);
    let decrypted = decipher.update(data);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString("utf-8");
  }

  return encryptedValue.toString("utf-8");
}

export interface ChromeCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
}

export function extractFacebookCookies(profileDir = "Default"): ChromeCookie[] {
  const cookiePath = join(CHROME_DIR, profileDir, "Cookies");

  if (!existsSync(cookiePath)) {
    throw new Error(`Cookies file not found for profile "${profileDir}"`);
  }

  // Copy to temp (Chrome locks the file)
  const tmpDir = join(homedir(), ".page-engager-tmp");
  mkdirSync(tmpDir, { recursive: true });
  const tmpPath = join(tmpDir, "Cookies");
  copyFileSync(cookiePath, tmpPath);

  const key = getChromeEncryptionKey();
  const cookieDb = new Database(tmpPath, { readonly: true });

  try {
    const rows = cookieDb
      .query(
        `SELECT name, encrypted_value, host_key, path, expires_utc, is_httponly, is_secure, samesite
         FROM cookies
         WHERE host_key LIKE '%facebook.com'`
      )
      .all() as any[];

    return rows.map((row) => {
      const decrypted = decryptCookieValue(
        Buffer.from(row.encrypted_value),
        key
      );

      const chromeEpochOffset = 11644473600;
      const expiresSec =
        row.expires_utc > 0
          ? Math.floor(row.expires_utc / 1000000) - chromeEpochOffset
          : -1;

      const sameSiteMap: Record<number, "Strict" | "Lax" | "None"> = {
        0: "None",
        1: "Lax",
        2: "Strict",
      };

      return {
        name: row.name,
        value: decrypted,
        domain: row.host_key,
        path: row.path,
        expires: expiresSec,
        httpOnly: !!row.is_httponly,
        secure: !!row.is_secure,
        sameSite: sameSiteMap[row.samesite] || "None",
      };
    });
  } finally {
    cookieDb.close();
  }
}

export function toPlaywrightCookies(cookies: ChromeCookie[]) {
  return cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
  }));
}
