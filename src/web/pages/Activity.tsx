import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Card, CardTitle, Badge } from "../components/ui";

export function Activity() {
  const [log, setLog] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    api.getActivityLog().then((d) => setLog(d.log));
    api.getReport(7).then(setReport);
  }, []);

  return (
    <div className="space-y-4">
      {/* Report Summary */}
      {report && (
        <Card>
          <CardTitle>7-Day Report</CardTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground">{report.summary.totalComments}</div>
              <div className="text-[10px] uppercase text-muted">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-success">{report.summary.sent}</div>
              <div className="text-[10px] uppercase text-muted">Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-danger">{report.summary.failed}</div>
              <div className="text-[10px] uppercase text-muted">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground">{report.summary.targets}</div>
              <div className="text-[10px] uppercase text-muted">Targets</div>
            </div>
          </div>

          {/* By day chart */}
          {report.byDay?.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-muted mb-2">Daily activity</div>
              <div className="flex items-end gap-1 h-20">
                {report.byDay.map((d: any) => {
                  const max = Math.max(...report.byDay.map((x: any) => x.total), 1);
                  const h = Math.max(4, (d.sent / max) * 80);
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-success/30 rounded-t" style={{ height: `${h}px` }}>
                        <div className="w-full bg-success rounded-t" style={{ height: `${(d.sent / Math.max(d.total, 1)) * 100}%` }} />
                      </div>
                      <span className="text-[8px] text-subtle">{d.date.split("-").pop()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* By target */}
          {report.byTarget?.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-muted mb-2">By target</div>
              {report.byTarget.map((t: any) => (
                <div key={t.name} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-foreground truncate flex-1">{t.name}</span>
                  <div className="flex gap-2">
                    <Badge variant="success">{t.sent} sent</Badge>
                    {t.failed > 0 && <Badge variant="danger">{t.failed} failed</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Activity Log */}
      <Card>
        <CardTitle>Activity Log</CardTitle>
        {log.length === 0 ? (
          <p className="text-sm text-subtle mt-3">No activity yet</p>
        ) : (
          <div className="mt-3">
            {log.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2.5 border-b border-ring last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={item.status === "sent" ? "success" : item.status === "failed" ? "danger" : "warning"}>
                      {item.status}
                    </Badge>
                    <span className="text-xs text-subtle">{item.targetName}</span>
                  </div>
                  <p className="text-sm text-muted truncate mt-0.5">{item.commentText}</p>
                </div>
                <span className="text-xs text-subtle ml-3 shrink-0">
                  {new Date(item.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
