"use client";

import { useState } from "react";
import type { Recipient } from "@/lib/emails";
import type { Message } from "@/lib/storage";
import { buildEmail, emailProblem } from "@/lib/template";

type Props = {
  recipients: Recipient[];
  message: Message; // the general message (used when a row has no own message)
  busy: boolean; // true while something is sending
  onSendOne: (email: string) => void;
};

// One email, exactly as the person will get it
function EmailCard({
  r,
  message,
  busy,
  onSendOne,
}: {
  r: Recipient;
  message: Message;
  busy: boolean;
  onSendOne: (email: string) => void;
}) {
  const mail = buildEmail(r, message);
  const problem = emailProblem(mail);
  const done = r.status === "sent" || r.status === "sending";

  return (
    <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      <p className="break-all text-sm">
        <span className="font-semibold">To:</span> {r.email}{" "}
        <span className="text-gray-600 dark:text-gray-400">({r.status})</span>
      </p>

      {/* Shows where the subject and the message come from */}
      <p className="mt-1 text-xs font-semibold text-green-700 dark:text-green-400">
        Subject from:{" "}
        {r.subject?.trim()
          ? "this person's row in the CSV"
          : "the general message"}
        <br />
        Message from:{" "}
        {r.message?.trim()
          ? "this person's row in the CSV"
          : "the general message"}
      </p>

      <p className="mt-2 break-words text-sm">
        <span className="font-semibold">Subject:</span> {mail.subject}
      </p>
      <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 font-sans text-sm dark:bg-gray-950">
        {mail.body}
      </pre>
      {problem && (
        <p
          role="alert"
          className="mt-2 text-sm font-medium text-red-600 dark:text-red-400"
        >
          Will not send: {problem}
        </p>
      )}
      <button
        type="button"
        onClick={() => onSendOne(r.email)}
        disabled={busy || done || !!problem}
        className="btn btn-primary mt-3 w-full sm:w-auto"
      >
        {r.status === "sent" ? "Already sent" : "Send this one"}
      </button>
    </div>
  );
}

export default function Preview({
  recipients,
  message,
  busy,
  onSendOne,
}: Props) {
  const [mode, setMode] = useState<"one" | "all">("one");
  const [index, setIndex] = useState(0);

  if (recipients.length === 0) return null;

  // Stay in range if people were removed from the list
  const current = Math.min(index, recipients.length - 1);

  return (
    <section className="card">
      <h2 className="mb-1 text-lg font-semibold">3. Preview</h2>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        This is exactly what each person will get. A row with its own subject or
        message from the CSV uses that. Other rows use the general message
        above.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={mode === "one"}
          onClick={() => setMode("one")}
          className={`btn flex-1 sm:flex-none ${mode === "one" ? "btn-primary" : "btn-secondary"}`}
        >
          One by one
        </button>
        <button
          type="button"
          aria-pressed={mode === "all"}
          onClick={() => setMode("all")}
          className={`btn flex-1 sm:flex-none ${mode === "all" ? "btn-primary" : "btn-secondary"}`}
        >
          Show all
        </button>
      </div>

      {mode === "one" ? (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={current === 0}
              onClick={() => setIndex(current - 1)}
            >
              Previous
            </button>
            <p className="text-sm font-semibold">
              {current + 1} of {recipients.length}
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={current >= recipients.length - 1}
              onClick={() => setIndex(current + 1)}
            >
              Next
            </button>
          </div>
          <EmailCard
            r={recipients[current]}
            message={message}
            busy={busy}
            onSendOne={onSendOne}
          />
        </div>
      ) : (
        <div className="mt-4 flex max-h-[36rem] flex-col gap-3 overflow-y-auto">
          {recipients.map((r) => (
            <EmailCard
              key={r.email}
              r={r}
              message={message}
              busy={busy}
              onSendOne={onSendOne}
            />
          ))}
        </div>
      )}
    </section>
  );
}
