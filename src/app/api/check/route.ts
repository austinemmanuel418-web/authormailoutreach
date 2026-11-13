import { NextResponse } from "next/server";
import { promises as dns } from "dns";
import { isAuthorized } from "@/lib/auth";
import { isValidFormat } from "@/lib/emails";
import type { CheckResult } from "@/lib/emails";

export const runtime = "nodejs"; // the dns module needs Node
export const maxDuration = 30;

// Common wrong domains -> right domain
const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yhoo.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "homail.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloook.com": "outlook.com",
  "outlook.con": "outlook.com",
  "iclod.com": "icloud.com",
  "icloud.con": "icloud.com",
};

// Common wrong endings (.con instead of .com, etc.)
const TLD_TYPOS: Record<string, string> = { con: "com", cmo: "com", ocm: "com", vom: "com", comm: "com" };

// Returns a fixed address if we spot a typo, otherwise null
function suggestFix(email: string): string | null {
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (DOMAIN_TYPOS[domain]) return `${local}@${DOMAIN_TYPOS[domain]}`;
  const parts = domain.split(".");
  const tld = parts[parts.length - 1];
  if (TLD_TYPOS[tld]) {
    parts[parts.length - 1] = TLD_TYPOS[tld];
    return `${local}@${parts.join(".")}`;
  }
  return null;
}

// Does this domain have a mail server (MX record)?
async function hasMailServer(domain: string): Promise<boolean> {
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), 5000)
      ),
    ]);
    return records.length > 0;
  } catch (e) {
    const code = (e as { code?: string }).code;
    // Only block when DNS clearly says "this domain has no mail"
    if (code === "ENOTFOUND" || code === "ENODATA") return false;
    return true; // timeout or DNS busy: not sure, so do not block
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Wrong app password" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { emails?: string[] };
  const emails = body.emails;
  if (!Array.isArray(emails) || emails.length > 100) {
    return NextResponse.json({ error: "Send an emails array (max 100)" }, { status: 400 });
  }

  // Check each domain only once, even if many addresses share it
  const domainCache = new Map<string, Promise<boolean>>();

  const results: CheckResult[] = await Promise.all(
    emails.map(async (email): Promise<CheckResult> => {
      if (!isValidFormat(email)) {
        return { email, ok: false, reason: "Invalid email format" };
      }
      const fix = suggestFix(email);
      if (fix) {
        return { email, ok: false, reason: `Possible typo. Did you mean ${fix}?`, suggestion: fix };
      }
      const domain = email.split("@")[1].toLowerCase();
      if (!domainCache.has(domain)) domainCache.set(domain, hasMailServer(domain));
      const ok = await domainCache.get(domain)!;
      return ok
        ? { email, ok: true }
        : { email, ok: false, reason: `The domain ${domain} has no mail server (no MX records)` };
    })
  );

  return NextResponse.json({ results });
}
