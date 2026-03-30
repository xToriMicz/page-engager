import type { Target, Template, Comment, ChromeStatus, PageInfo, SendCommentResult, ScanResult } from "../types";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// Targets
export const getTargets = () => request<Target[]>("/targets");
export const addTarget = (data: { name?: string; url: string; interactionCount?: number; source?: string }) =>
  request<Target>("/targets", { method: "POST", body: JSON.stringify(data) });
export const resolveTarget = (url: string) =>
  request<{ name: string; url: string }>("/targets/resolve", { method: "POST", body: JSON.stringify({ url }) });
export const discoverEngagers = (pageUrl: string) =>
  request<{ engagers: { name: string; url: string; interactionCount: number }[]; total: number }>(
    "/targets/discover", { method: "POST", body: JSON.stringify({ pageUrl }) }
  );
export const deleteTarget = (id: number) =>
  request<{ success: boolean }>(`/targets/${id}`, { method: "DELETE" });
export const deleteAllTargets = () =>
  request<{ ok: boolean }>("/targets", { method: "DELETE" });

// Templates
export const getTemplates = () => request<Template[]>("/templates");
export const addTemplate = (data: { name: string; content: string; category?: string }) =>
  request<Template>("/templates", { method: "POST", body: JSON.stringify(data) });
export const deleteTemplate = (id: number) =>
  request<{ success: boolean }>(`/templates/${id}`, { method: "DELETE" });

// Comments
export const generateComment = (postText: string) =>
  request<{ comment: string }>("/comments/generate", { method: "POST", body: JSON.stringify({ postText }) });
export const getComments = () => request<Comment[]>("/comments");
export const scanPosts = (targetId: number) =>
  request<ScanResult>(`/comments/scan/${targetId}`, { method: "POST" });
export const getLastScan = (targetId: number) =>
  request<ScanResult & { scannedAt: string | null }>(`/comments/scan/${targetId}`);
export const sendComment = (data: {
  targetId: number;
  postUrl: string;
  postText?: string;
  commentText: string;
  templateId?: number;
}) => request<SendCommentResult>("/comments/send", { method: "POST", body: JSON.stringify(data) });

// Analysis
export const analyzePost = (postText: string) =>
  request<{ type: string; rating: number; summary: string }>("/comments/analyze", { method: "POST", body: JSON.stringify({ postText }) });

// Batch AI — analyze + generate for multiple posts at once
export const batchAI = (posts: { text: string; index: number }[]) =>
  request<{ results: { index: number; comment: string; analysis: { type: string; rating: number; summary: string } }[] }>(
    "/comments/batch-ai", { method: "POST", body: JSON.stringify({ posts }) }
  );

// Auto-engage
export const getAutoConfig = () => request<{ maxPostsPerTarget: number; roundsPerDay: number; delayBetweenComments: number }>("/auto/config");
export const setAutoConfig = (data: { maxPostsPerTarget?: number; roundsPerDay?: number; delayBetweenComments?: number }) =>
  request<{ ok: boolean }>("/auto/config", { method: "POST", body: JSON.stringify(data) });
export const getAutoStatus = () => request<{ running: boolean }>("/auto/status");
export const runAuto = () => request<{ sent: number; skipped: number; failed: number }>("/auto/run", { method: "POST" });
export const stopAuto = () => request<{ ok: boolean }>("/auto/stop", { method: "POST" });

// Activity
export const getActivityLog = () => request<{ log: any[]; total: number }>("/activity/log");
export const getReport = (days = 7) => request<any>(`/activity/report?days=${days}`);
export const getStats = () => request<{ totalSent: number; todaySent: number; todayFailed: number; targets: number }>("/activity/stats");

// Chrome connection & pages
export const getChromeStatus = () =>
  request<ChromeStatus>("/sessions/status");
export const getHeadless = () => request<{ headless: boolean }>("/sessions/headless");
export const setHeadless = (headless: boolean) =>
  request<{ headless: boolean; message: string }>("/sessions/headless", { method: "POST", body: JSON.stringify({ headless }) });
export const getPages = () =>
  request<PageInfo[]>("/sessions/pages");
export const switchPage = (pageName: string) =>
  request<{ success: boolean; currentPage: string }>("/sessions/switch-page", {
    method: "POST",
    body: JSON.stringify({ pageName }),
  });
