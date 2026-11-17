"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CheckResult, Recipient } from "@/lib/emails";
import { buildEmail, emailProblem } from "@/lib/template";
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
import Preview from "@/components/Preview";

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

  // "Send test to me": always goes to your own Gmail.
  // It uses the FIRST person on the list as the example.
  async function sendTest() {
    const mail = buildEmail(recipients[0] ?? { name: "" }, message);
    const problem = emailProblem(mail);
    if (problem) {
      setInfo(`Cannot send test: ${problem}`);
      return;
    }
    setTesting(true);
    setInfo("Sending test...");
    const { status, data } = await callApi("/api/send", password, {
      test: true,
      subject: "TEST: " + mail.subject,
      body: mail.body,
    });
    if (status === 401) {
      onUnauthorized();
    } else {
      setInfo(data.ok ? "Test email sent to your own Gmail." : `Test failed: ${data.error ?? "unknown error"}`);
    }
    setTesting(false);
  }

  // The main sending loop. Works for one person or for many.
  async function run(targets: Recipient[]) {
    if (targets.length === 0) {
      setInfo("Nothing to send.");
      return;
    }

    // Confirm box
    const count = Math.min(targets.length, settings.limit);
    const ok = window.confirm(
      count === 1 && targets.length === 1
        ? `Send this email to ${targets[0].email} now?\n\nThis uses your real Gmail account.`
        : `Send to up to ${count} people now?\n\nEach person gets the email you saw in the preview.\nThis uses your real Gmail account.`
    );
    if (!ok) return;

    stopRef.current = false;
    setRunning(true);
    try {
      // STEP 0: check each person's final subject + message
      const readyList: Recipient[] = [];
      for (const r of targets) {
        const problem = emailProblem(buildEmail(r, message));
        if (problem) setOne(r.email, { status: "failed", error: problem });
        else readyList.push(r);
      }
      if (readyList.length === 0) {
        setInfo("Nothing was sent. See the reasons in the list and in the preview.");
        return;
      }

      // STEP 1: check addresses (typos + MX), 40 at a time
      setInfo("Checking addresses...");
      const good: Recipient[] = [];
      for (let i = 0; i < readyList.length; i += 40) {
        const chunk = readyList.slice(i, i + 40);
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
        const mail = buildEmail(r, message); // this person's own email
        setOne(r.email, { status: "sending", error: undefined });
        setInfo(`Sending ${i + 1} of ${batch.length} to ${r.email}...`);

        const { status, data } = await callApi("/api/send", password, {
          to: r.email,
          subject: mail.subject,
          body: mail.body,
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

  // "Send all": everyone who is waiting
  function sendAll() {
    const targets = recipients.filter((r) => r.status === "waiting");
    if (targets.length === 0) setInfo("Nothing is waiting to be sent.");
    else run(targets);
  }

  // "Retry failed": everyone who failed
  function retryFailed() {
    const targets = recipients.filter((r) => r.status === "failed");
    if (targets.length === 0) setInfo("No failed emails to retry.");
    else run(targets);
  }

  // "Send this one" (button in the preview)
  function sendOne(email: string) {
    const r = recipients.find((x) => x.email === email);
    if (r) run([r]);
  }

  function stop() {
    stopRef.current = true;
    setInfo("Stopping after the current email...");
  }

  return (
    <>
      <Preview recipients={recipients} message={message} busy={busy} onSendOne={sendOne} />

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">4. Send</h2>

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
            onClick={sendAll}
            disabled={busy || recipients.length === 0}
            className="btn btn-primary"
          >
            Send all
          </button>
          <button
            type="button"
            onClick={retryFailed}
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
    </>
  );
}
