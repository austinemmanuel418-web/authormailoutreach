import { timingSafeEqual } from "crypto";

// Returns true only if the request carries the right APP_PASSWORD
export function isAuthorized(req: Request): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false; // no password set on the server = nobody gets in

  const given = req.headers.get("x-app-password") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b); // safe comparison
}
