import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Button, Card } from "../components/ui";
import type { ChromeStatus } from "../types";

export function Sessions() {
  const [status, setStatus] = useState<ChromeStatus | null>(null);
  const [checking, setChecking] = useState(true);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const s = await api.getChromeStatus();
      setStatus(s);
    } catch {
      setStatus({ browser: "", connected: false });
    }
    setChecking(false);
  };

  useEffect(() => { checkStatus(); }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-5">Chrome Connection</h1>

      <Card title="Status" className="mb-4">
        {checking ? (
          <p className="text-dark-300">Checking...</p>
        ) : status?.connected ? (
          <div>
            <p className="text-green-500 text-base font-bold mb-2">Connected</p>
            <p className="text-dark-300 text-[13px]">{status.browser}</p>
          </div>
        ) : (
          <div>
            <p className="text-red-500 text-base font-bold mb-3">Not Connected</p>
            <p className="text-dark-300 text-[13px] mb-3">
              Start Chrome with debug port to connect:
            </p>
            <code className="block p-3 bg-dark-700 rounded-md text-xs text-orange-500 break-all mb-3">
              /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
            </code>
            <p className="text-dark-300 text-[13px]">
              Then click Refresh below to connect.
            </p>
          </div>
        )}
        <Button onClick={checkStatus} disabled={checking} className="mt-3">
          {checking ? "Checking..." : "Refresh Status"}
        </Button>
      </Card>

      <Card title="How it works">
        <ol className="pl-5 leading-relaxed text-dark-200 text-[13px] list-decimal">
          <li>Start Chrome with <code className="text-orange-500">--remote-debugging-port=9222</code></li>
          <li>Login to Facebook in Chrome as your page</li>
          <li>Come back here and click Refresh Status</li>
          <li>Go to Target Pages to add pages to engage</li>
          <li>Go to Dashboard to scan posts and send comments</li>
        </ol>
      </Card>
    </div>
  );
}
