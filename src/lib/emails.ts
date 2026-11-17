// Types and helpers for the recipient list

export type Status = "waiting" | "sending" | "sent" | "failed";

export type Recipient = {
  email: string;
  name: string;
  status: Status;
  error?: string; // the reason, when status is "failed"
  subject?: string; // this person's own subject from the CSV (optional)
  message?: string; // this person's own message from the CSV (optional)
};

// Answer from /api/check for one address
export type CheckResult = {
  email: string;
  ok: boolean;
  reason?: string;
  suggestion?: string;
};

export type Parsed = {
  email: string;
  name: string;
  subject?: string;
  message?: string;
};

// Simple format check: something@something.tld, no spaces
const EMAIL_RE = /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]{2,}$/;
export function isValidFormat(email: string): boolean {
  return EMAIL_RE.test(email);
}

// Finds the first "something@something" in a line
const FIND_RE = /[^\s,;<>()"]+@[^\s,;<>()"]+/;

// Pasted text: one per line, optional name after the email
export function parsePasted(text: string): {
  items: Parsed[];
  skipped: number;
} {
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

// Guess the separator from the first line: comma, semicolon or tab
function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/)[0] ?? "";
  const counts: [string, number][] = [
    [",", first.split(",").length],
    [";", first.split(";").length],
    ["\t", first.split("\t").length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ",";
}

// Reads the whole CSV into rows of cells.
// Handles "quoted cells" that contain commas AND new lines (long messages).
function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"'; // "" inside quotes means one quote
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c; // new lines inside quotes stay part of the cell
      }
    } else if (c === '"' && cur === "") {
      inQuotes = true; // a quote at the start of a cell opens quotes
    } else if (c === delimiter) {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      rows.push(row);
      row = [];
    } else {
      cur += c;
    }
  }
  // Last cell (when the file does not end with a new line)
  if (cur !== "" || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  // Drop completely empty rows
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// CSV columns: email, name, subject, message.
// Header names can vary ("Email Address", "Author Name", "Personalized Message").
// Without a header row the order is: email, name.
export function parseCsv(text: string): {
  items: Parsed[];
  skipped: number;
  columns: string; // tells you which columns were found
  withMessage: number; // how many rows have their own message
  withSubject: number; // how many rows have their own subject
} {
  const clean = text.replace(/^\uFEFF/, "");
  let rows = parseCsvRows(clean, detectDelimiter(clean));
  // Excel sometimes adds a first line like "sep=," : ignore it
  if (
    rows.length > 0 &&
    rows[0].length === 1 &&
    /^sep=/i.test(rows[0][0].trim())
  ) {
    rows = rows.slice(1);
  }

  const items: Parsed[] = [];
  let skipped = 0;
  if (rows.length === 0) {
    return {
      items,
      skipped,
      columns: "The file is empty.",
      withMessage: 0,
      withSubject: 0,
    };
  }

  // Simple header names: lowercase, only letters and numbers
  const header = rows[0].map((h) =>
    h
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
  );

  let subjectCol = header.findIndex((h) => h.includes("subject"));
  let messageCol = header.findIndex(
    (h, i) =>
      i !== subjectCol &&
      /message|body|content|personali[sz]ed|pitch|draft|text/.test(h),
  );
  const foundEmail = header.findIndex(
    (h, i) => i !== subjectCol && i !== messageCol && /e ?mail/.test(h),
  );

  // It is a header row only if it has an email column and no real address in it
  const hasHeader = foundEmail >= 0 && !rows[0].some((c) => c.includes("@"));
  if (!hasHeader) {
    subjectCol = -1;
    messageCol = -1;
  }

  const emailCol = hasHeader ? foundEmail : 0;
  const nameCol = hasHeader
    ? header.findIndex(
        (h, i) =>
          ![emailCol, subjectCol, messageCol].includes(i) &&
          /name|author/.test(h),
      )
    : 1;

  let withMessage = 0;
  let withSubject = 0;
  for (let i = hasHeader ? 1 : 0; i < rows.length; i++) {
    const cells = rows[i];
    const email = (cells[emailCol] ?? "").trim().toLowerCase();
    if (!email.includes("@")) {
      skipped++;
      continue;
    }
    const message =
      messageCol >= 0
        ? (cells[messageCol] ?? "").replace(/\r\n?/g, "\n").trim() || undefined
        : undefined;
    const subject =
      subjectCol >= 0
        ? (cells[subjectCol] ?? "").replace(/\s+/g, " ").trim() || undefined
        : undefined;
    if (message) withMessage++;
    if (subject) withSubject++;
    items.push({
      email,
      name: nameCol >= 0 ? (cells[nameCol] ?? "").trim() : "",
      subject,
      message,
    });
  }

  // A short report so you can see what the app found
  const label = (i: number) => (i >= 0 ? `"${rows[0][i].trim()}"` : "none");
  const columns = hasHeader
    ? `Columns used: email = ${label(emailCol)}, name = ${label(nameCol)}, subject = ${label(
        subjectCol,
      )}, message = ${label(messageCol)}.` +
      (messageCol < 0 || subjectCol < 0
        ? ` Not found: ${[
            subjectCol < 0 ? "subject" : "",
            messageCol < 0 ? "message" : "",
          ]
            .filter(Boolean)
            .join(" and ")}. Your headers: ${rows[0].join(", ")}.`
        : "")
    : "No header row found: used column 1 as email and column 2 as name.";

  return { items, skipped, columns, withMessage, withSubject };
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
      subject: it.subject,
      message: it.message,
      status: ok ? "waiting" : "failed",
      error: ok ? undefined : "Invalid email format",
    });
    added++;
  }
  return { list, added, duplicates };
}
