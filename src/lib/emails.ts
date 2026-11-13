// Types and helpers for the recipient list

export type Status = "waiting" | "sending" | "sent" | "failed";

export type Recipient = {
  email: string;
  name: string;
  status: Status;
  error?: string; // the reason, when status is "failed"
};

// Answer from /api/check for one address
export type CheckResult = {
  email: string;
  ok: boolean;
  reason?: string;
  suggestion?: string;
};

type Parsed = { email: string; name: string };

// Simple format check: something@something.tld, no spaces
const EMAIL_RE = /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]{2,}$/;
export function isValidFormat(email: string): boolean {
  return EMAIL_RE.test(email);
}

// Finds the first "something@something" in a line
const FIND_RE = /[^\s,;<>()"]+@[^\s,;<>()"]+/;

// Pasted text: one per line, optional name after the email
export function parsePasted(text: string): { items: Parsed[]; skipped: number } {
  const items: Parsed[] = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(FIND_RE);
    if (!m) {
      skipped++; // no @ in this line
      continue;
    }
    const email = m[0].toLowerCase();
    // Whatever is left on the line is the name
    const name = line
      .replace(m[0], " ")
      .replace(/[,;<>"]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    items.push({ email, name });
  }
  return { items, skipped };
}

// Splits one CSV line into cells (handles "quoted, text")
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === "," || c === ";") {
      cells.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  return cells.map((s) => s.trim());
}

// CSV with columns: email, name (header row is optional)
export function parseCsv(text: string): { items: Parsed[]; skipped: number } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  const items: Parsed[] = [];
  let skipped = 0;
  if (lines.length === 0) return { items, skipped };

  let emailCol = 0;
  let nameCol = 1;
  let start = 0;
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  if (header.includes("email")) {
    emailCol = header.indexOf("email");
    nameCol = header.indexOf("name"); // -1 if there is no name column
    start = 1;
  }

  for (let i = start; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const email = (cells[emailCol] ?? "").toLowerCase();
    const name = nameCol >= 0 ? cells[nameCol] ?? "" : "";
    if (!email.includes("@")) {
      skipped++;
      continue;
    }
    items.push({ email, name });
  }
  return { items, skipped };
}

// Adds new people to the list and removes duplicates
export function mergeRecipients(existing: Recipient[], items: Parsed[]) {
  const seen = new Set(existing.map((r) => r.email));
  const list = [...existing];
  let added = 0;
  let duplicates = 0;
  for (const it of items) {
    if (seen.has(it.email)) {
      duplicates++;
      continue;
    }
    seen.add(it.email);
    const ok = isValidFormat(it.email);
    list.push({
      email: it.email,
      name: it.name,
      status: ok ? "waiting" : "failed",
      error: ok ? undefined : "Invalid email format",
    });
    added++;
  }
  return { list, added, duplicates };
}
