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
export const getTargets = () => request<any[]>("/targets");
export const addTarget = (data: { name: string; url: string }) =>
  request<any>("/targets", { method: "POST", body: JSON.stringify(data) });
export const deleteTarget = (id: number) =>
  request<any>(`/targets/${id}`, { method: "DELETE" });

// Templates
export const getTemplates = () => request<any[]>("/templates");
export const addTemplate = (data: { name: string; content: string; category?: string }) =>
  request<any>("/templates", { method: "POST", body: JSON.stringify(data) });
export const deleteTemplate = (id: number) =>
  request<any>(`/templates/${id}`, { method: "DELETE" });

// Comments
export const getComments = () => request<any[]>("/comments");
export const scanPosts = (targetId: number) =>
  request<{ target: string; posts: any[] }>(`/comments/scan/${targetId}`, { method: "POST" });
export const sendComment = (data: {
  targetId: number;
  postUrl: string;
  postText?: string;
  commentText: string;
  templateId?: number;
}) => request<any>("/comments/send", { method: "POST", body: JSON.stringify(data) });

// Sessions
export const getSessions = () => request<any[]>("/sessions");
export const openLogin = () =>
  request<{ message: string }>("/sessions/login", { method: "POST" });
export const captureSession = (name: string) =>
  request<any>("/sessions/capture", { method: "POST", body: JSON.stringify({ name }) });
export const deleteSession = (id: number) =>
  request<any>(`/sessions/${id}`, { method: "DELETE" });
export const closeBrowser = () =>
  request<any>("/sessions/close-browser", { method: "POST" });
