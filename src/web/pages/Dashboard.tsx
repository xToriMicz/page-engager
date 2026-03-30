import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Card, CardTitle, Button, Badge, Select, Input, PostSkeleton, useToast } from "../components/ui";
import type { Target, Template, Comment } from "../types";

interface Props {
  currentPage: string | null;
}

export function Dashboard({ currentPage }: Props) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    api.getTargets().then(setTargets);
    api.getComments().then(setComments);
    api.getTemplates().then(setTemplates);
  }, []);

  const handleScan = async () => {
    if (!selectedTarget) return;
    setScanning(true);
    setPosts([]);
    try {
      const result = await api.scanPosts(selectedTarget);
      setPosts(result.posts);
      toast(`Found ${result.posts.length} posts`, "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
    setScanning(false);
  };

  const handleSend = async (post: any) => {
    if (!commentText.trim()) return;
    setSending(true);
    try {
      const result = await api.sendComment({
        targetId: selectedTarget!,
        postUrl: post.url,
        postText: post.text,
        commentText,
      });
      if (result.status === "sent") {
        toast("Comment sent", "success");
        setCommentText("");
        api.getComments().then(setComments);
      } else {
        toast(`Failed: ${result.error}`, "error");
      }
    } catch (e: any) {
      toast(e.message, "error");
    }
    setSending(false);
  };

  const sentToday = comments.filter((c) => {
    const d = new Date(c.createdAt);
    const now = new Date();
    return c.status === "sent" && d.toDateString() === now.toDateString();
  }).length;

  const noPage = !currentPage;

  return (
    <div className="space-y-4">
      {noPage && (
        <div className="flex items-center gap-2 px-4 py-3 bg-warning/10 border border-warning/20 rounded-[var(--radius-lg)] text-sm text-warning">
          Go to Settings to select a page before commenting
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Targets", value: targets.length },
          { label: "Templates", value: templates.length },
          { label: "Sent", value: comments.filter((c) => c.status === "sent").length },
          { label: "Today", value: sentToday },
        ].map((s) => (
          <Card key={s.label} padding="sm" className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1">{s.label}</div>
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>Scan & Comment</CardTitle>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <Select
            value={selectedTarget ?? ""}
            onChange={(e) => setSelectedTarget(Number(e.target.value) || null)}
            className="flex-1"
          >
            <option value="">Select target page</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
          <Button onClick={handleScan} disabled={!selectedTarget || scanning || noPage}>
            {scanning ? "Scanning..." : "Scan"}
          </Button>
        </div>
      </Card>

      {scanning && <PostSkeleton />}

      {!scanning && posts.length > 0 && (
        <div className="space-y-3">
          {posts.map((post, i) => (
            <Card key={i} className="animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                {post.author && <span className="text-xs font-medium text-foreground">{post.author}</span>}
                {post.timestamp && <span className="text-xs text-subtle">{post.timestamp}</span>}
              </div>
              <p className="text-sm text-muted leading-relaxed mb-3 line-clamp-3">
                {post.text || <span className="italic text-subtle">No text content</span>}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setCommentText(t.content)}
                    className="px-2.5 py-1 text-xs rounded-full bg-surface-hover text-muted hover:text-foreground hover:bg-overlay border-none cursor-pointer transition-colors duration-150"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Type comment..."
                  className="flex-1"
                />
                <Button variant="success" onClick={() => handleSend(post)} disabled={sending || !commentText.trim() || noPage}>
                  {sending ? "..." : "Send"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {comments.length > 0 && (
        <Card>
          <CardTitle>Recent</CardTitle>
          <div className="mt-3 space-y-0">
            {comments.slice(0, 8).map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-ring last:border-0">
                <span className="text-sm text-muted truncate flex-1 mr-3">{c.commentText.slice(0, 60)}</span>
                <Badge variant={c.status === "sent" ? "success" : c.status === "failed" ? "danger" : "warning"}>
                  {c.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
