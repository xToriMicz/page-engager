import { execSync } from "child_process";
import { join } from "path";
import { homedir } from "os";
import { createDecipheriv, pbkdf2Sync } from "crypto";
import Database from "better-sqlite3";

const CHROME_PROFILE = join(homedir(), "Library/Application Support/Google/Chrome");

interface ChromeCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
}

function getEncryptionKey(): Buffer {
  const password = execSync('security find-generic-password -s "Chrome Safe Storage" -w')
    .toString()
    .trim();
  // Chrome on macOS uses PBKDF2 with 1003 iterations
  return pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1");
}

function decryptValue(encryptedValue: Buffer, key: Buffer): string {
  if (encryptedValue.length <= 3) return "";
  const version = encryptedValue.subarray(0, 3).toString();
  if (version !== "v10") return "";

  const iv = Buffer.alloc(16, " ");
  const encrypted = encryptedValue.subarray(3);
  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  decipher.setAutoPadding(true);

  let decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  // Chrome AES-CBC produces: 16-byte block cipher prefix + actual value
  // The first block (16 bytes) is IV-derived noise — skip it
  // But actual cookie values start after the noise ends
  // Strategy: find where ASCII-printable content starts
  for (let i = 0; i < decrypted.length; i++) {
    const byte = decrypted[i];
    // Find first printable ASCII character that's part of actual value
    if (byte >= 0x30 && byte <= 0x7a) {
      // Verify next bytes are also printable
      let allPrintable = true;
      for (let j = i; j < Math.min(i + 3, decrypted.length); j++) {
        if (decrypted[j] < 0x20 || decrypted[j] > 0x7e) {
          allPrintable = false;
          break;
        }
      }
      if (allPrintable) {
        return decrypted.subarray(i).toString("utf8");
      }
    }
  }
  return decrypted.toString("utf8");
}

function chromeTimestampToUnix(chromeTs: number): number {
  // Chrome timestamps are microseconds since 1601-01-01
  // Unix timestamps are seconds since 1970-01-01
  // Difference: 11644473600 seconds
  return Math.floor(chromeTs / 1000000) - 11644473600;
}

export function extractFacebookCookies(profileDir = "Profile 8"): ChromeCookie[] {
  const cookiesPath = join(CHROME_PROFILE, profileDir, "Cookies");
  const key = getEncryptionKey();

  // Open a copy to avoid locking Chrome's file
  const db = new Database(cookiesPath, { readonly: true, fileMustExist: true });

  const rows = db.prepare(`
    SELECT name, encrypted_value, host_key, path, expires_utc, is_httponly, is_secure, samesite
    FROM cookies
    WHERE host_key LIKE '%facebook.com%' OR host_key LIKE '%fbcdn.net%'
  `).all() as any[];

  db.close();

  const cookies: ChromeCookie[] = [];

  for (const row of rows) {
    const value = decryptValue(row.encrypted_value, key);
    if (!value) continue;

    const sameSiteMap: Record<number, "Strict" | "Lax" | "None"> = {
      0: "None",
      1: "Lax",
      2: "Strict",
    };

    const domain = row.host_key.startsWith(".") ? row.host_key : row.host_key;
    const expires = row.expires_utc ? chromeTimestampToUnix(row.expires_utc) : undefined;
    const now = Math.floor(Date.now() / 1000);

    // Skip expired cookies
    if (expires !== undefined && expires > 0 && expires < now) continue;
    if (!row.name || !value) continue;

    const cookie: ChromeCookie = {
      name: row.name,
      value,
      domain,
      path: row.path || "/",
      httpOnly: !!row.is_httponly,
      secure: !!row.is_secure,
      sameSite: sameSiteMap[row.samesite] || "None",
      expires: expires && expires > 0 ? expires : -1,
    };
    cookies.push(cookie);
  }

  return cookies;
}
