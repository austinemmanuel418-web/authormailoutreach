"use client";

import { useState } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { mergeRecipients, parseCsv, parsePasted } from "@/lib/emails";
import type { Recipient, Status } from "@/lib/emails";

type Props = {
  recipients: Recipient[];
  setRecipients: Dispatch<SetStateAction<Recipient[]>>;
  locked: boolean; // true while sending
};

// Badge colors for each status
const BADGE: Record<Status, string> = {
  waiting: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  sending: "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  sent: "bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100",
  failed: "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100",
};

export default function Recipients({
  recipients,
  setRecipients,
  locked,
}: Props) {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");

  // Add parsed people to the list and tell the user what happened
  function addParsed(parsed: {
    items: { email: string; name: string }[];
    skipped: number;
  }) {
    const { list, added, duplicates } = mergeRecipients(
      recipients,
      parsed.items,
    );
    setRecipients(list);
    setNote(
      `Added ${added}. Duplicates removed: ${duplicates}. Lines skipped (no email found): ${parsed.skipped}.`,
    );
  }

  function handleAdd() {
    addParsed(parsePasted(text));
    setText("");
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    addParsed(parseCsv(await file.text()));
    e.target.value = ""; // so the same file can be picked again
  }

  function remove(email: string) {
    setRecipients((prev) => prev.filter((r) => r.email !== email));
  }
  // Remove everyone from the list at once
  function clearAll() {
    if (
      window.confirm(
        `Remove all ${recipients.length} recipients from the list?`,
      )
    ) {
      setRecipients([]);
      setNote("");
    }
  }

  const sent = recipients.filter((r) => r.status === "sent").length;
  const failed = recipients.filter((r) => r.status === "failed").length;

  return (
    <section className="card">
      <h2 className="mb-1 text-lg font-semibold">1. Recipients</h2>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        One email per line. You can add a name after the email. Or upload a CSV
        with the columns email and name.
      </p>

      <label htmlFor="paste" className="label">
        Paste emails
      </label>
      <textarea
        id="paste"
        rows={5}
        className="input"
        value={text}
        disabled={locked}
        onChange={(e) => setText(e.target.value)}
        placeholder={"ada@example.com Ada Lovelace\nbob@example.com"}
      />
      <button
        type="button"
        onClick={handleAdd}
        disabled={locked || !text.trim()}
        className="btn btn-primary mt-3 w-full sm:w-auto"
      >
        Add to list
      </button>

      <label htmlFor="csv" className="label mt-5">
        Or upload a CSV file
      </label>
      <input
        id="csv"
        type="file"
        accept=".csv,text/csv"
        disabled={locked}
        onChange={handleFile}
        className="input file:mr-3 file:rounded-lg file:border-0 file:bg-green-600 file:px-3 file:py-1.5 file:text-white"
      />

      {note && (
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{note}</p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">
          Recipients: {recipients.length}
          <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400">
            (sent {sent}, failed {failed})
          </span>
        </p>
        {recipients.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            disabled={locked}
            className="btn btn-secondary"
          >
            Clear all
          </button>
        )}
      </div>

      {recipients.length > 0 && (
        <ul className="mt-3 max-h-96 divide-y divide-gray-200 overflow-y-auto rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {recipients.map((r) => (
            <li
              key={r.email}
              className="flex items-start justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="break-all font-medium">{r.email}</p>
                {r.name && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {r.name}
                  </p>
                )}
                {r.status === "failed" && r.error && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {r.error}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${BADGE[r.status]}`}
                >
                  {r.status}
                </span>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => remove(r.email)}
                  aria-label={`Remove ${r.email}`}
                  className="btn btn-secondary px-4"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
