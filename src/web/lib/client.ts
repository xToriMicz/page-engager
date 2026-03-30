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
export const addTarget = (data: { name?: string; url: string }) =>
  request<Target>("/targets", { method: "POST", body: JSON.stringify(data) });
export const resolveTarget = (url: string) =>
  request<{ name: string; url: string }>("/targets/resolve", { method: "POST", body: JSON.stringify({ url }) });
export const deleteTarget = (id: number) =>
  request<{ success: boolean }>(`/targets/${id}`, { method: "DELETE" });

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
export const sendComment = (data: {
  targetId: number;
  postUrl: string;
  postText?: string;
  commentText: string;
  templateId?: number;
}) => request<SendCommentResult>("/comments/send", { method: "POST", body: JSON.stringify(data) });

// Chrome connection & pages
export const getChromeStatus = () =>
  request<ChromeStatus>("/sessions/status");
export const getPages = () =>
  request<PageInfo[]>("/sessions/pages");
export const switchPage = (pageName: string) =>
  request<{ success: boolean; currentPage: string }>("/sessions/switch-page", {
    method: "POST",
    body: JSON.stringify({ pageName }),
  });
