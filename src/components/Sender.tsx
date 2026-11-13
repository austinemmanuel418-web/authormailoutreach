"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CheckResult, Recipient } from "@/lib/emails";
import { fillText, findLeftovers } from "@/lib/template";
import {
  DEFAULT_SETTINGS,
  addSentToday,
  addToSentLog,
  getSentToday,
  loadSentLog,
  loadSettings,
  saveSettings,
} from "@/lib/storage";
import type { Message, Settings } from "@/lib/storage";

type Props = {
  recipients: Recipient[];
  setRecipients: Dispatch<SetStateAction<Recipient[]>>;
  message: Message;
  password: string;
  onUnauthorized: () => void;
  running: boolean;
  setRunning: (v: boolean) => void;
};

type ApiData = { ok?: boolean; error?: string; results?: CheckResult[] };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Calls one of our API routes. Never throws.
async function callApi(
  path: string,
  password: string,
  payload: unknown
): Promise<{ status: number; data: ApiData }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-password": password },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as ApiData;
    return { status: res.status, data };
  } catch {
    return { status: 0, data: { error: "Network error" } };
  }
}

// Turns typed text into a safe number (0 or more)
function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function Sender({
  recipients,
  setRecipients,
  message,
  password,
  onUnauthorized,
  running,
  setRunning,
}: Props) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [sentToday, setSentToday] = useState(0);
  const [info, setInfo] = useState("");
  const [testing, setTesting] = useState(false);
  const stopRef = useRef(false); // the Stop button flips this

  // Load saved settings and today's counter
  useEffect(() => {
    setSettings(loadSettings());
    setSentToday(getSentToday());
    setReady(true);
  }, []);

  // Save settings when they change
  useEffect(() => {
    if (ready) saveSettings(settings);
  }, [settings, ready]);

  const busy = running || testing;
  const failedCount = recipients.filter((r) => r.status === "failed").length;

  // Change one row (found by email)
  function setOne(email: string, patch: Partial<Recipient>) {
    setRecipients((prev) => prev.map((r) => (r.email === email ? { ...r, ...patch } : r)));
  }

  // Returns a problem text, or null if the message is fine
  function messageProblem(): string | null {
    if (!message.subject.trim()) return "Please write a subject.";
    if (!message.body.trim()) return "Please write a message.";
    const left = [...findLeftovers(message.subject), ...findLeftovers(message.body)];
    if (left.length > 0) {
      return `Fill or remove this bracket text first: ${[...new Set(left)].join(", ")}`;
    }
    return null;
  }

  // Random wait between emails, with a countdown. Stop ends it early.
  async function waitRandom() {
    const min = Math.max(0, settings.minWait);
    const max = Math.max(min, settings.maxWait);
    const seconds = Math.round(min + Math.random() * (max - min));
    for (let s = seconds; s > 0 && !stopRef.current; s--) {
      setInfo(`Waiting ${s}s before the next email...`);
      await sleep(1000);
    }
  }

  // "Send test to me": always goes to your own Gmail
  async function sendTest() {
    const problem = messageProblem();
    if (problem) {
      setInfo(problem);
      return;
    }
    setTesting(true);
    setInfo("Sending test...");
    const name = recipients[0]?.name ?? ""; // use the first name on the list as an example
    const { status, data } = await callApi("/api/send", password, {
      test: true,
      subject: "TEST: " + fillText(message.subject, name),
      body: fillText(message.body, name),
    });
    if (status === 401) {
      onUnauthorized();
    } else {
      setInfo(data.ok ? "Test email sent to your own Gmail." : `Test failed: ${data.error ?? "unknown error"}`);
    }
    setTesting(false);
  }

  // kind "all" = people who are waiting, "retry" = people who failed
  async function startRun(kind: "all" | "retry") {
    const problem = messageProblem();
    if (problem) {
      setInfo(problem);
      return;
    }

    const targets = recipients.filter((r) => r.status === (kind === "retry" ? "failed" : "waiting"));
    if (targets.length === 0) {
      setInfo(kind === "retry" ? "No failed emails to retry." : "Nothing is waiting to be sent.");
      return;
    }

    // Confirm box
    const count = Math.min(targets.length, settings.limit);
    const ok = window.confirm(
      `Send "${message.subject}" to up to ${count} ${count === 1 ? "person" : "people"} now?\n\n` +
        `This uses your real Gmail account.`
    );
    if (!ok) return;

    stopRef.current = false;
    setRunning(true);
    try {
      // STEP 1: check addresses (typos + MX), 40 at a time
      setInfo("Checking addresses...");
      const good: Recipient[] = [];
      for (let i = 0; i < targets.length; i += 40) {
        const chunk = targets.slice(i, i + 40);
        const { status, data } = await callApi("/api/check", password, {
          emails: chunk.map((r) => r.email),
        });
        if (status === 401) {
          onUnauthorized();
          return;
        }
        if (!data.results) {
          setInfo(`Address check failed: ${data.error ?? "server error"}. Nothing was sent.`);
          return;
        }
        const byEmail = new Map(data.results.map((r) => [r.email, r]));
        for (const r of chunk) {
          const res = byEmail.get(r.email);
          if (res && !res.ok) setOne(r.email, { status: "failed", error: res.reason });
          else good.push(r);
        }
      }

      // STEP 2: ask before emailing someone we already emailed
      const log = loadSentLog();
      const again = good.filter((r) => log[r.email]);
      let queue = good;
      if (again.length > 0) {
        const sendAgain = window.confirm(
          `${again.length} address(es) were already emailed before:\n\n` +
            again.slice(0, 5).map((r) => r.email).join("\n") +
            (again.length > 5 ? "\n..." : "") +
            `\n\nOK = send to them again\nCancel = skip them`
        );
        if (!sendAgain) {
          for (const r of again) {
            setOne(r.email, { status: "failed", error: "Skipped: already emailed before" });
          }
          queue = good.filter((r) => !log[r.email]);
        }
      }

      // STEP 3: apply the per-run limit
      const batch = queue.slice(0, settings.limit);
      if (batch.length === 0) {
        setInfo("No valid addresses left to send.");
        return;
      }

      // STEP 4: send one by one with a random wait
      let sent = 0;
      let failed = 0;
      for (let i = 0; i < batch.length; i++) {
        if (stopRef.current) break;
        const r = batch[i];
        setOne(r.email, { status: "sending", error: undefined });
        setInfo(`Sending ${i + 1} of ${batch.length} to ${r.email}...`);

        const { status, data } = await callApi("/api/send", password, {
          to: r.email,
          subject: fillText(message.subject, r.name),
          body: fillText(message.body, r.name),
        });

        if (status === 401) {
          setOne(r.email, { status: "waiting" });
          onUnauthorized();
          return;
        }
        if (data.ok) {
          sent++;
          addToSentLog(r.email);
          setSentToday(addSentToday());
          setOne(r.email, { status: "sent" });
        } else {
          failed++;
          setOne(r.email, { status: "failed", error: data.error ?? `Server error (${status})` });
        }

        if (i < batch.length - 1 && !stopRef.current) await waitRandom();
      }

      const left = queue.length - batch.length;
      setInfo(
        `${stopRef.current ? "Stopped." : "Finished."} Sent: ${sent}. Failed: ${failed}.` +
          (left > 0 ? ` ${left} still waiting (run limit reached).` : "")
      );
    } finally {
      setRunning(false);
    }
  }

  function stop() {
    stopRef.current = true;
    setInfo("Stopping after the current email...");
  }

  return (
    <section className="card">
      <h2 className="mb-4 text-lg font-semibold">3. Send</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="minWait" className="label">
            Wait at least (seconds)
          </label>
          <input
            id="minWait"
            type="number"
            min={0}
            inputMode="numeric"
            className="input"
            disabled={busy}
            value={settings.minWait}
            onChange={(e) => setSettings({ ...settings, minWait: num(e.target.value) })}
          />
        </div>
        <div>
          <label htmlFor="maxWait" className="label">
            Wait at most (seconds)
          </label>
          <input
            id="maxWait"
            type="number"
            min={0}
            inputMode="numeric"
            className="input"
            disabled={busy}
            value={settings.maxWait}
            onChange={(e) => setSettings({ ...settings, maxWait: num(e.target.value) })}
          />
        </div>
        <div>
          <label htmlFor="limit" className="label">
            Emails per run (limit)
          </label>
          <input
            id="limit"
            type="number"
            min={1}
            inputMode="numeric"
            className="input"
            disabled={busy}
            value={settings.limit}
            onChange={(e) => setSettings({ ...settings, limit: num(e.target.value) })}
          />
        </div>
      </div>

      <p className="mt-4 font-semibold">
        Sent today: {sentToday} / {settings.limit}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" onClick={sendTest} disabled={busy} className="btn btn-secondary">
          Send test to me
        </button>
        <button
          type="button"
          onClick={() => startRun("all")}
          disabled={busy || recipients.length === 0}
          className="btn btn-primary"
        >
          Send all
        </button>
        <button
          type="button"
          onClick={() => startRun("retry")}
          disabled={busy || failedCount === 0}
          className="btn btn-secondary"
        >
          Retry failed ({failedCount})
        </button>
        {running && (
          <button type="button" onClick={stop} className="btn btn-danger">
            Stop
          </button>
        )}
      </div>

      {info && (
        <p aria-live="polite" className="mt-4 text-sm font-medium text-gray-800 dark:text-gray-200">
          {info}
        </p>
      )}
    </section>
  );
}
