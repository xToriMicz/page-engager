import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Button, Card } from "../components/ui";
import { useToast } from "../components/ui/Toast";
import type { Target, Template, Comment, Post } from "../types";

interface DashboardProps {
  currentPage: string | null;
}

export function Dashboard({ currentPage }: DashboardProps) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const { toast } = useToast();

  const hasPage = currentPage !== null;

  useEffect(() => {
    api.getTargets().then(setTargets);
    api.getComments().then(setComments);
    api.getTemplates().then(setTemplates);
  }, []);

  const todayCount = comments.filter((c) => {
    if (c.status !== "sent" || !c.sentAt) return false;
    const sent = new Date(c.sentAt);
    const now = new Date();
    return sent.toDateString() === now.toDateString();
  }).length;

  const handleScan = async () => {
    if (!selectedTarget || !hasPage) return;
    setScanning(true);
    try {
      const result = await api.scanPosts(selectedTarget);
      setPosts(result.posts);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Scan failed";
      toast(msg, "error");
    }
    setScanning(false);
  };

  const handleSend = async (post: Post) => {
    if (!commentText.trim() || !selectedTarget || !hasPage) return;
    setSending(true);
    try {
      const result = await api.sendComment({
        targetId: selectedTarget,
        postUrl: post.url,
        postText: post.text ?? undefined,
        commentText,
      });
      if (result.status === "sent") {
        toast("Comment sent!", "success");
        setCommentText("");
        api.getComments().then(setComments);
      } else {
        toast(`Failed: ${result.error}`, "error");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Send failed";
      toast(msg, "error");
    }
    setSending(false);
  };

  return (
    <div>
      <h1 className="text-lg font-semibold text-white mb-5">Dashboard</h1>

      {/* Warning: no page selected */}
      {!hasPage && (
        <div className="mb-4 px-4 py-3 bg-amber-900/10 border border-amber-500/30 rounded-lg text-sm text-amber-400">
          เลือกเพจก่อนใน Settings
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Targets" value={targets.length} />
        <StatCard label="Templates" value={templates.length} />
        <StatCard label="Sent" value={comments.filter((c) => c.status === "sent").length} />
        <StatCard label="Today" value={todayCount} />
      </div>

      {/* Scan */}
      <Card title="Scan" className="mb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={selectedTarget ?? ""}
            onChange={(e) => setSelectedTarget(Number(e.target.value) || null)}
            disabled={!hasPage}
            className="flex-1 px-3 py-2 bg-page border border-border rounded-md text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none transition-colors duration-150 disabled:opacity-50"
          >
            <option value="">-- Select Target --</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button onClick={handleScan} disabled={!selectedTarget || scanning || !hasPage}>
            {scanning ? "Scanning..." : "Scan Posts"}
          </Button>
        </div>
      </Card>

      {/* Posts */}
      {scanning && (
        <Card className="mb-4">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-card-hover rounded-md animate-pulse" />
            ))}
          </div>
        </Card>
      )}

      {!scanning && posts.length > 0 && (
        <Card title={`Posts (${posts.length})`} className="mb-4">
          <div className="space-y-3">
            {posts.map((post, i) => (
              <div key={i} className="p-3 bg-page rounded-lg border border-border">
                <p className="text-xs text-text-muted mb-1">
                  {post.author && <span className="text-text-secondary">{post.author} · </span>}
                  {post.timestamp}
                </p>
                <p className="text-sm text-gray-300 mb-3 line-clamp-2">
                  {post.text || <em className="text-text-muted">No text</em>}
                </p>

                {/* Template quick buttons */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setCommentText(t.content)}
                      className="px-3 py-1 text-xs bg-card-hover hover:bg-[#252540] text-text-primary rounded-full border-none cursor-pointer transition-colors duration-150"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Type comment..."
                    disabled={!hasPage}
                    className="flex-1 px-3 py-2 bg-page border border-border rounded-md text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none transition-colors duration-150 disabled:opacity-50"
                  />
                  <Button
                    onClick={() => handleSend(post)}
                    disabled={sending || !commentText.trim() || !hasPage}
                    className="!bg-green-600 hover:!bg-green-500"
                  >
                    {sending ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Comments */}
      <Card title="Recent Comments">
        {comments.length === 0 ? (
          <p className="text-sm text-text-muted">No comments yet</p>
        ) : (
          <div className="space-y-0">
            {comments.slice(0, 10).map((c) => (
              <div
                key={c.id}
                className="flex justify-between items-center px-3 py-2 border-b border-border text-sm"
              >
                <span className="truncate mr-4 text-gray-300">{c.commentText.slice(0, 80)}</span>
                <span
                  className={`text-xs shrink-0 ${
                    c.status === "sent"
                      ? "text-green-500"
                      : c.status === "failed"
                        ? "text-red-500"
                        : "text-amber-500"
                  }`}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 text-center">
      <div className="text-xs text-text-secondary mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
