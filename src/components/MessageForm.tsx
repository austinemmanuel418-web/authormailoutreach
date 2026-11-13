"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Message } from "@/lib/storage";
import { findLeftovers } from "@/lib/template";

type Props = {
  message: Message;
  setMessage: Dispatch<SetStateAction<Message>>;
};

export default function MessageForm({ message, setMessage }: Props) {
  // Any [bracket] text that is NOT [First Name] or [Name]
  const leftovers = [
    ...new Set([...findLeftovers(message.subject), ...findLeftovers(message.body)]),
  ];

  return (
    <section className="card">
      <h2 className="mb-1 text-lg font-semibold">2. Message</h2>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Optional placeholders: [First Name] and [Name]. If a row has no name, they become
        Hello. Your message is saved on this device.
      </p>

      <label htmlFor="subject" className="label">
        Subject
      </label>
      <input
        id="subject"
        type="text"
        className="input"
        value={message.subject}
        onChange={(e) => setMessage({ ...message, subject: e.target.value })}
      />

      <label htmlFor="body" className="label mt-4">
        Message (plain text)
      </label>
      <textarea
        id="body"
        rows={10}
        className="input"
        value={message.body}
        onChange={(e) => setMessage({ ...message, body: e.target.value })}
      />

      {leftovers.length > 0 && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
          Sending is blocked. Fill or remove this bracket text: {leftovers.join(", ")}
        </p>
      )}
    </section>
  );
}
