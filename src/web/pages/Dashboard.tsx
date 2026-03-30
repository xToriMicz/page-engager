import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Card, CardTitle, Button, Badge, Select, PostSkeleton, useToast } from "../components/ui";
import type { Target, Comment } from "../types";

interface PostAnalysis {
  type: string;
  rating: number;
  summary: string;
}

interface Props {
  currentPage: string | null;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  greeting: { label: "Greeting", color: "primary" },
  normal: { label: "Normal", color: "default" },
  sale: { label: "Sale", color: "warning" },
  review: { label: "Review", color: "success" },
  news: { label: "News", color: "primary" },
  share: { label: "Share", color: "default" },
};

export function Dashboard({ currentPage }: Props) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [commentTexts, setCommentTexts] = useState<Record<number, string>>({});
  const [analyses, setAnalyses] = useState<Record<number, PostAnalysis>>({});
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
    setAnalyses({});
    setCommentTexts({});
    try {
      const result = await api.scanPosts(selectedTarget);
      setPosts(result.posts);

      // Auto-generate AI comments + analyze all posts in parallel
      for (let i = 0; i < result.posts.length; i++) {
        const post = result.posts[i];
        if (post.text) {
          setGenerating(i);
          try {
            const [ai, analysis] = await Promise.all([
              api.generateComment(post.text),
              api.analyzePost(post.text),
            ]);
            setCommentTexts((prev) => ({ ...prev, [i]: ai.comment }));
            setAnalyses((prev) => ({ ...prev, [i]: analysis }));
          } catch {}
        }
      }
      setGenerating(null);
      toast(`Found ${result.posts.length} posts — AI analyzed & generated comments`, "success");
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

  const renderStars = (rating: number) => {
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  };

  return (
    <div className="space-y-4">
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
        <p className="text-xs text-subtle mt-2">AI will auto-classify, rate, and generate comments for each post</p>
      </Card>

      {scanning && <PostSkeleton />}

      {/* Posts with full info */}
      {!scanning && posts.length > 0 && (
        <div className="space-y-3">
          {posts.map((post, i) => {
            const analysis = analyses[i];
            const typeInfo = analysis ? TYPE_LABELS[analysis.type] || TYPE_LABELS.normal : null;

            return (
              <Card key={i} className="animate-fade-in">
                {/* Post header with metadata */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {post.author && <span className="text-xs font-medium text-foreground">{post.author}</span>}
                    {post.timestamp && <span className="text-xs text-subtle">{post.timestamp}</span>}
                    {/* Media type */}
                    {post.hasVideo && <Badge variant="primary">Video</Badge>}
                    {post.hasImage && !post.hasVideo && <Badge variant="default">Photo</Badge>}
                    {!post.hasImage && !post.hasVideo && <Badge variant="default">Text</Badge>}
                  </div>
                  {/* Post link */}
                  {post.url && (
                    <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline shrink-0">
                      Open
                    </a>
                  )}
                </div>

                {/* AI Analysis badges */}
                {analysis && (
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant={typeInfo?.color as any || "default"}>{typeInfo?.label || analysis.type}</Badge>
                    <span className="text-xs text-warning">{renderStars(analysis.rating)}</span>
                    <span className="text-xs text-subtle">{analysis.summary}</span>
                  </div>
                )}

                {/* Engagement stats */}
                <div className="flex items-center gap-3 mb-2 text-xs text-subtle">
                  {post.reactionCount && <span>{post.reactionCount} reactions</span>}
                  {post.commentCount > 0 && <span>{post.commentCount} comments</span>}
                </div>

                {/* Post text (caption) */}
                <p className="text-sm text-muted leading-relaxed mb-3 line-clamp-4">
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
                  <textarea
                    value={commentTexts[i] || ""}
                    onChange={(e) => setCommentTexts((prev) => ({ ...prev, [i]: e.target.value }))}
                    placeholder={generating === i ? "AI generating..." : "Comment text"}
                    rows={2}
                    className="w-full bg-transparent border border-ring rounded-[var(--radius-sm)] px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-primary"
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
            );
          })}
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
