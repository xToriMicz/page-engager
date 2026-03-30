import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Button, Card, Input } from "../components/ui";
import { useToast } from "../components/ui/Toast";
import type { Target, Template, Comment, Post } from "../types";

export function Dashboard() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [chromeConnected, setChromeConnected] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    api.getTargets().then(setTargets);
    api.getComments().then(setComments);
    api.getChromeStatus().then((s) => setChromeConnected(s.connected)).catch(() => {});
    api.getTemplates().then(setTemplates);
  }, []);

  const handleScan = async () => {
    if (!selectedTarget) return;
    setScanning(true);
    try {
      const result = await api.scanPosts(selectedTarget);
      setPosts(result.posts);
    } catch (e: any) {
      toast(e.message, "error");
    }
    setScanning(false);
  };

  const handleSend = async (post: Post) => {
    if (!commentText.trim() || !selectedTarget) return;
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
    } catch (e: any) {
      toast(e.message, "error");
    }
    setSending(false);
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-5">Dashboard</h1>

      {/* Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatusCard label="Targets" value={targets.length} />
        <StatusCard label="Templates" value={templates.length} />
        <StatusCard label="Comments Sent" value={comments.filter((c) => c.status === "sent").length} />
        <StatusCard
          label="Chrome"
          value={chromeConnected ? "Connected" : "Disconnected"}
          color={chromeConnected ? "text-green-500" : "text-red-500"}
        />
      </div>

      {/* Scan & Comment */}
      <Card title="Scan & Comment">
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <select
            value={selectedTarget ?? ""}
            onChange={(e) => setSelectedTarget(Number(e.target.value) || null)}
            className="flex-1 px-3 py-2 bg-dark-700 border border-dark-500 rounded-md text-dark-100 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">-- Select Target --</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button onClick={handleScan} disabled={!selectedTarget || scanning}>
            {scanning ? "Scanning..." : "Scan Posts"}
          </Button>
        </div>

        {posts.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Posts Found ({posts.length})</h4>
            {posts.map((post, i) => (
              <Card key={i} className="mb-3">
                <p className="text-xs text-dark-200 mb-2">{post.timestamp}</p>
                <p className="mb-3">
                  {post.text || <em className="text-dark-400">No text</em>}
                </p>

                {/* Template quick-fill */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {templates.map((t) => (
                    <Button
                      key={t.id}
                      variant="secondary"
                      size="sm"
                      onClick={() => setCommentText(t.content)}
                    >
                      {t.name}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Type comment..."
                    className="flex-1"
                  />
                  <Button
                    onClick={() => handleSend(post)}
                    disabled={sending || !commentText.trim()}
                    className="!bg-green-600 hover:!bg-green-700"
                  >
                    {sending ? "Sending..." : "Send"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Comments */}
      <Card title="Recent Comments" className="mt-4">
        {comments.length === 0 ? (
          <p className="text-dark-400 text-sm">No comments yet</p>
        ) : (
          comments.slice(0, 10).map((c) => (
            <div
              key={c.id}
              className="flex justify-between items-center px-3 py-2 border-b border-dark-600 text-sm"
            >
              <span className="truncate mr-4">{c.commentText.slice(0, 80)}</span>
              <span
                className={`text-xs shrink-0 ${
                  c.status === "sent"
                    ? "text-green-500"
                    : c.status === "failed"
                      ? "text-red-500"
                      : "text-yellow-500"
                }`}
              >
                {c.status}
              </span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function StatusCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card className="text-center">
      <div className="text-xs text-dark-300 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color || "text-white"}`}>{value}</div>
    </Card>
  );
}
