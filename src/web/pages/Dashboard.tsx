import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Card, CardTitle, Button, Badge, Select, Input, PostSkeleton, useToast } from "../components/ui";
import type { Target, Comment } from "../types";

interface Props {
  currentPage: string | null;
}

export function Dashboard({ currentPage }: Props) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [commentTexts, setCommentTexts] = useState<Record<number, string>>({});
  const [generating, setGenerating] = useState<number | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    api.getTargets().then(setTargets);
    api.getComments().then(setComments);
  }, []);

  const noPage = !currentPage;

  const handleScan = async () => {
    if (!selectedTarget) return;
    setScanning(true);
    setPosts([]);
    try {
      const result = await api.scanPosts(selectedTarget);
      setPosts(result.posts);
      // Auto-generate AI comments for all posts
      for (let i = 0; i < result.posts.length; i++) {
        const post = result.posts[i];
        if (post.text) {
          setGenerating(i);
          try {
            const ai = await api.generateComment(post.text);
            setCommentTexts((prev) => ({ ...prev, [i]: ai.comment }));
          } catch {}
        }
      }
      setGenerating(null);
      toast(`Found ${result.posts.length} posts — AI generated comments`, "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
    setScanning(false);
  };

  const handleRegenerate = async (i: number, postText: string) => {
    setGenerating(i);
    try {
      const ai = await api.generateComment(postText);
      setCommentTexts((prev) => ({ ...prev, [i]: ai.comment }));
    } catch (e: any) {
      toast(e.message, "error");
    }
    setGenerating(null);
  };

  const handleSend = async (i: number, post: any) => {
    const text = commentTexts[i];
    if (!text?.trim()) return;
    setSending(i);
    try {
      const result = await api.sendComment({
        targetId: selectedTarget!,
        postUrl: post.url,
        postText: post.text,
        commentText: text,
      });
      if (result.status === "sent") {
        toast("Sent", "success");
        api.getComments().then(setComments);
      } else {
        toast(`Failed: ${result.error}`, "error");
      }
    } catch (e: any) {
      toast(e.message, "error");
    }
    setSending(null);
  };

  const sentCount = comments.filter((c) => c.status === "sent").length;
  const todayCount = comments.filter((c) => {
    return c.status === "sent" && new Date(c.createdAt).toDateString() === new Date().toDateString();
  }).length;

  return (
    <div className="space-y-4">
      {/* Warning */}
      {noPage && (
        <div className="px-4 py-3 bg-warning/10 border border-warning/20 rounded-[var(--radius-lg)] text-sm text-warning">
          Go to Settings to select a page first
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Targets", value: targets.length },
          { label: "Total Sent", value: sentCount },
          { label: "Today", value: todayCount },
        ].map((s) => (
          <Card key={s.label} padding="sm" className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1">{s.label}</div>
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Scan */}
      <Card>
        <CardTitle>Scan & Engage</CardTitle>
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
            {scanning ? "Scanning..." : "Scan & Generate"}
          </Button>
        </div>
        <p className="text-xs text-subtle mt-2">AI will auto-generate comments for each post</p>
      </Card>

      {/* Loading */}
      {scanning && <PostSkeleton />}

      {/* Posts with AI comments */}
      {!scanning && posts.length > 0 && (
        <div className="space-y-3">
          {posts.map((post, i) => (
            <Card key={i} className="animate-fade-in">
              {/* Post header */}
              <div className="flex items-center gap-2 mb-2">
                {post.author && <span className="text-xs font-medium text-foreground">{post.author}</span>}
                {post.timestamp && <span className="text-xs text-subtle">{post.timestamp}</span>}
              </div>

              {/* Post text */}
              <p className="text-sm text-muted leading-relaxed mb-3 line-clamp-3">
                {post.text || <span className="italic text-subtle">No text</span>}
              </p>

              {/* AI-generated comment */}
              <div className="bg-background rounded-[var(--radius-md)] p-3 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-primary">AI Comment</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleRegenerate(i, post.text)}
                    disabled={generating === i}
                  >
                    {generating === i ? "..." : "Regenerate"}
                  </Button>
                </div>
                <Input
                  value={commentTexts[i] || ""}
                  onChange={(e) => setCommentTexts((prev) => ({ ...prev, [i]: e.target.value }))}
                  placeholder={generating === i ? "AI generating..." : "Comment text"}
                />
              </div>

              {/* Send */}
              <div className="flex justify-end">
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => handleSend(i, post)}
                  disabled={sending === i || !commentTexts[i]?.trim() || noPage}
                >
                  {sending === i ? "Sending..." : "Send Comment"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Recent */}
      {comments.length > 0 && (
        <Card>
          <CardTitle>Recent</CardTitle>
          <div className="mt-3">
            {comments.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-ring last:border-0">
                <span className="text-sm text-muted truncate flex-1 mr-3">{c.commentText.slice(0, 50)}</span>
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
