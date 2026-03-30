import { db, schema } from "./index";
import { eq } from "drizzle-orm";

export function getSetting(key: string): string | null {
  const row = db.select().from(schema.appSettings).where(eq(schema.appSettings.key, key)).get();
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const existing = getSetting(key);
  if (existing !== null) {
    db.update(schema.appSettings).set({ value }).where(eq(schema.appSettings.key, key)).run();
  } else {
    db.insert(schema.appSettings).values({ key, value }).run();
  }
}
