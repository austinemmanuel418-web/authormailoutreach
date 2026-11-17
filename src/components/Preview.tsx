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
  onEdit: (email: string, subject: string, body: string) => void;
};

// One email, exactly as the person will get it (with an Edit button)
function EmailCard({
  r,
  message,
  busy,
  onSendOne,
  onEdit,
}: {
  r: Recipient;
  message: Message;
  busy: boolean;
  onSendOne: (email: string) => void;
  onEdit: (email: string, subject: string, body: string) => void;
}) {
  const mail = buildEmail(r, message);
  const problem = emailProblem(mail);
  const done = r.status === "sent" || r.status === "sending";

  const [editing, setEditing] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");

  // Start editing: copy the current subject and message into the boxes
  function startEdit() {
    setSubjectDraft(mail.subject);
    setBodyDraft(mail.body);
    setEditing(true);
  }

  // Save: this person's subject and message are replaced by your text
  function save() {
    onEdit(r.email, subjectDraft.trim(), bodyDraft.trim());
    setEditing(false);
  }

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
          ? "this person's own text (CSV or your edit)"
          : "the general message"}
        <br />
        Message from:{" "}
        {r.message?.trim()
          ? "this person's own text (CSV or your edit)"
          : "the general message"}
      </p>

      {editing ? (
        <div className="mt-3">
          <label htmlFor={`subject-${r.email}`} className="label">
            Subject
          </label>
          <input
            id={`subject-${r.email}`}
            type="text"
            className="input"
            value={subjectDraft}
            onChange={(e) => setSubjectDraft(e.target.value)}
          />
          <label htmlFor={`body-${r.email}`} className="label mt-3">
            Message
          </label>
          <textarea
            id={`body-${r.email}`}
            rows={12}
            className="input"
            value={bodyDraft}
            onChange={(e) => setBodyDraft(e.target.value)}
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={save}
              disabled={
                busy || done || !subjectDraft.trim() || !bodyDraft.trim()
              }
              className="btn btn-primary"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
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
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={startEdit}
              disabled={busy || done}
              className="btn btn-secondary"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onSendOne(r.email)}
              disabled={busy || done || !!problem}
              className="btn btn-primary"
            >
              {r.status === "sent" ? "Already sent" : "Send this one"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Preview({
  recipients,
  message,
  busy,
  onSendOne,
  onEdit,
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
        This is exactly what each person will get. Tap Edit to change a subject
        or message before sending. A row with its own subject or message uses
        that. Other rows use the general message above.
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
          {/* key makes each person get a fresh card, so an edit never carries over */}
          <EmailCard
            key={recipients[current].email}
            r={recipients[current]}
            message={message}
            busy={busy}
            onSendOne={onSendOne}
            onEdit={onEdit}
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
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </section>
  );
}
