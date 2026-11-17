"use client";

import { useEffect, useState } from "react";
import type { Recipient } from "@/lib/emails";
import {
  clearPassword,
  loadMessage,
  loadPassword,
  loadRecipients,
  saveMessage,
  saveRecipients,
} from "@/lib/storage";
import type { Message } from "@/lib/storage";
import ThemeToggle from "@/components/ThemeToggle";
import Unlock from "@/components/Unlock";
import Recipients from "@/components/Recipients";
import MessageForm from "@/components/MessageForm";
import Sender from "@/components/Sender";

export default function Home() {
  const [ready, setReady] = useState(false); // true after localStorage is read
  const [password, setPassword] = useState(""); // empty = locked
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [message, setMessage] = useState<Message>({ subject: "", body: "" });
  const [running, setRunning] = useState(false); // true while "Send all" runs

  // Load the saved message, password and recipient list once
  useEffect(() => {
    setMessage(loadMessage());
    setPassword(loadPassword());
    setRecipients(loadRecipients());
    setReady(true);
  }, []);

  // Save the message every time it changes (only after the first load)
  useEffect(() => {
    if (ready) saveMessage(message);
  }, [message, ready]);

  // Save the recipient list every time it changes (only after the first load)
  useEffect(() => {
    if (ready) saveRecipients(recipients);
  }, [recipients, ready]);

  // If the server says the password is wrong, lock the page again
  function lock() {
    clearPassword();
    setPassword("");
  }

  if (!ready) return null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-green-700 dark:text-green-400">
          Bulk Mailer
        </h1>
        <ThemeToggle />
      </header>

      {!password ? (
        <Unlock onUnlock={setPassword} />
      ) : (
        <>
          <Recipients
            recipients={recipients}
            setRecipients={setRecipients}
            locked={running}
          />
          <MessageForm message={message} setMessage={setMessage} />
          <Sender
            recipients={recipients}
            setRecipients={setRecipients}
            message={message}
            password={password}
            onUnauthorized={lock}
            running={running}
            setRunning={setRunning}
          />
        </>
      )}
    </main>
  );
}
