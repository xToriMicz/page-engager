import type { Page } from "playwright";

type PreviewListener = (event: PreviewEvent) => void;

export interface PreviewEvent {
  type: "frame" | "action" | "status" | "done" | "error";
  data: string | Buffer;
  timestamp: string;
}

const listeners = new Set<PreviewListener>();
let active = false;

export function onPreview(fn: PreviewListener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isPreviewActive() {
  return active;
}

function emit(event: PreviewEvent) {
  for (const fn of listeners) fn(event);
}

export function emitAction(message: string) {
  emit({ type: "action", data: message, timestamp: new Date().toISOString() });
}

export function emitStatus(message: string) {
  emit({ type: "status", data: message, timestamp: new Date().toISOString() });
}

export function emitError(message: string) {
  emit({ type: "error", data: message, timestamp: new Date().toISOString() });
}

export function emitDone(message: string) {
  active = false;
  emit({ type: "done", data: message, timestamp: new Date().toISOString() });
}

export function setPreviewActive(val: boolean) {
  active = val;
}

// High FPS capture — CDP captureScreenshot in a tight loop for fixed 60 FPS
export async function startScreencast(page: Page): Promise<() => void> {
  active = true;

  try {
    const cdp = await (page as any).context().newCDPSession(page);
    let running = true;
    const TARGET_FPS = 60;
    const FRAME_MS = 1000 / TARGET_FPS;

    console.log(`[preview] Starting ${TARGET_FPS} FPS capture loop`);

    (async () => {
      while (running && active) {
        const t0 = performance.now();
        try {
          const { data } = await cdp.send("Page.captureScreenshot", {
            format: "jpeg",
            quality: 20,
            optimizeForSpeed: true,
          });
          const buf = Buffer.from(data, "base64");
          emit({ type: "frame", data: buf, timestamp: "" });
        } catch {}
        const elapsed = performance.now() - t0;
        const wait = Math.max(1, FRAME_MS - elapsed);
        await new Promise((r) => setTimeout(r, wait));
      }
    })();

    return () => {
      running = false;
      active = false;
      cdp.detach().catch(() => {});
    };
  } catch (e) {
    console.log(`[preview] CDP capture failed: ${e}, falling back to CDP screencast`);
    return startCDPScreencast(page);
  }
}

// Fallback: CDP screencast
async function startCDPScreencast(page: Page): Promise<() => void> {
  try {
    const cdp = await (page as any).context().newCDPSession(page);

    cdp.on("Page.screencastFrame", async (params: any) => {
      const buf = Buffer.from(params.data, "base64");
      emit({ type: "frame", data: buf, timestamp: "" });
      try {
        await cdp.send("Page.screencastFrameAck", { sessionId: params.sessionId });
      } catch {}
    });

    await cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 25,
      maxWidth: 1280,
      maxHeight: 800,
      everyNthFrame: 1,
    });

    console.log("[preview] CDP screencast started");

    return async () => {
      try {
        await cdp.send("Page.stopScreencast").catch(() => {});
        await cdp.detach().catch(() => {});
      } catch {}
      active = false;
    };
  } catch (e) {
    console.log(`[preview] CDP screencast failed: ${e}, falling back to interval`);
    return startIntervalCapture(page);
  }
}

// Last resort fallback: interval screenshots
function startIntervalCapture(page: Page): () => void {
  active = true;
  let running = true;

  (async () => {
    while (running && active) {
      try {
        const buf = await page.screenshot({ type: "jpeg", quality: 25 });
        emit({ type: "frame", data: buf, timestamp: "" });
      } catch {}
      await new Promise((r) => setTimeout(r, 33));
    }
  })();

  return () => { running = false; active = false; };
}

export async function captureScreenshot(page: Page) {
  try {
    const buf = await page.screenshot({ type: "jpeg", quality: 30 });
    emit({ type: "frame", data: buf, timestamp: "" });
  } catch {}
}

export function startAutoCapture(page: Page, intervalMs = 500): () => void {
  return startIntervalCapture(page);
}
