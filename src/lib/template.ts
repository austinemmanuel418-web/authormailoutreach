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
