"use client";

import { useState } from "react";
import { savePassword } from "@/lib/storage";

export default function Unlock({ onUnlock }: { onUnlock: (pw: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      // We test the password with an empty address check
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-password": value },
        body: JSON.stringify({ emails: [] }),
      });
      if (res.ok) {
        savePassword(value);
        onUnlock(value);
      } else if (res.status === 401) {
        setError("Wrong app password. Also check that APP_PASSWORD is set on the server.");
      } else {
        setError("Server error. Check your environment variables.");
      }
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(false);
  }

  return (
    <section className="card">
      <h2 className="mb-3 text-lg font-semibold">Unlock</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="app-password" className="label">
          App password (the APP_PASSWORD value)
        </label>
        <input
          id="app-password"
          type="password"
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="current-password"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !value} className="btn btn-primary mt-4 w-full sm:w-auto">
          {busy ? "Checking..." : "Unlock"}
        </button>
      </form>
    </section>
  );
}
