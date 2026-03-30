export interface Target {
  id: number;
  name: string;
  url: string;
  pageId: string | null;
  active: boolean;
  createdAt: string;
}

export interface Template {
  id: number;
  name: string;
  content: string;
  category: string | null;
  createdAt: string;
}

export interface Comment {
  id: number;
  targetId: number | null;
  templateId: number | null;
  postUrl: string;
  postText: string | null;
  commentText: string;
  status: "pending" | "sent" | "failed";
  sentAt: string | null;
  createdAt: string;
}

export interface Post {
  url: string;
  text: string | null;
  timestamp: string;
  author?: string;
}

export interface ChromeStatus {
  browser: string;
  connected: boolean;
  currentPage?: string;
}

export interface PageInfo {
  name: string;
  active: boolean;
}

export interface SendCommentResult {
  status: "sent" | "failed";
  error?: string;
}

export interface ScanResult {
  target: string;
  posts: Post[];
}
