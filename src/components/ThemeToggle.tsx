"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // Read the current theme (already set by the script in layout.tsx)
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light"); // remember the choice
    } catch {
      /* ignore */
    }
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={dark} className="btn btn-secondary">
      {dark ? "☀ Light mode" : "☾ Dark mode"}
    </button>
  );
}
