// Everything we keep in the browser (localStorage) lives here

export type Message = { subject: string; body: string };
export type Settings = { minWait: number; maxWait: number; limit: number };

export const DEFAULT_SETTINGS: Settings = { minWait: 10, maxWait: 20, limit: 30 };

const KEYS = {
  message: "bulk:message",
  settings: "bulk:settings",
  sentLog: "bulk:sentlog",
  daily: "bulk:daily",
  password: "bulk:password",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: ignore */
  }
}

// Message
export const loadMessage = () => read<Message>(KEYS.message, { subject: "", body: "" });
export const saveMessage = (m: Message) => write(KEYS.message, m);

// Settings (wait time, limit)
export const loadSettings = (): Settings => ({
  ...DEFAULT_SETTINGS,
  ...read<Partial<Settings>>(KEYS.settings, {}),
});
export const saveSettings = (s: Settings) => write(KEYS.settings, s);

// Log of addresses already emailed: { "a@b.com": "2026-11-13T10:00:00Z" }
export const loadSentLog = () => read<Record<string, string>>(KEYS.sentLog, {});
export function addToSentLog(email: string) {
  const log = loadSentLog();
  log[email] = new Date().toISOString();
  write(KEYS.sentLog, log);
}

// "Sent today" counter (resets by itself when the date changes)
function today(): string {
  return new Date().toLocaleDateString("en-CA"); // looks like 2026-11-13
}
export function getSentToday(): number {
  const d = read<{ date: string; count: number }>(KEYS.daily, { date: "", count: 0 });
  return d.date === today() ? d.count : 0;
}
export function addSentToday(): number {
  const n = getSentToday() + 1;
  write(KEYS.daily, { date: today(), count: n });
  return n;
}

// App password (so you only type it once on this device)
export const loadPassword = () => read<string>(KEYS.password, "");
export const savePassword = (p: string) => write(KEYS.password, p);
export function clearPassword() {
  try {
    localStorage.removeItem(KEYS.password);
  } catch {
    /* ignore */
  }
}
