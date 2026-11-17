// What to write when a row has no name.
// If your greeting is "Hi [First Name]," you may prefer "there".
export const FALLBACK = "Hello";

// Replaces [First Name] and [Name] (any upper/lower case)
export function fillText(text: string, name: string): string {
  const full = name.trim();
  const first = full.split(/\s+/)[0] || "";
  return text
    .replace(/\[first name\]/gi, first || FALLBACK)
    .replace(/\[name\]/gi, full || FALLBACK);
}

// Finds any OTHER [bracket] text left in the message
export function findLeftovers(text: string): string[] {
  const cleaned = text.replace(/\[first name\]/gi, "").replace(/\[name\]/gi, "");
  return cleaned.match(/\[[^\]]*\]/g) ?? [];
}

type Own = { name: string; subject?: string; message?: string };
type General = { subject: string; body: string };
export type Built = { subject: string; body: string };

// Builds the final email for ONE person.
// If the CSV gave this person a subject/message, use it. Otherwise use the general one.
export function buildEmail(r: Own, general: General): Built {
  const subject = fillText(r.subject?.trim() ? r.subject : general.subject, r.name);
  const body = fillText(r.message?.trim() ? r.message : general.body, r.name);
  return { subject, body };
}

// Returns the reason this email must NOT be sent, or null if it is fine
export function emailProblem(mail: Built): string | null {
  if (!mail.subject.trim()) return "No subject";
  if (!mail.body.trim()) return "No message";
  const left = findLeftovers(mail.subject + "\n" + mail.body);
  if (left.length > 0) return `Leftover bracket text: ${[...new Set(left)].join(", ")}`;
  return null;
}
