import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { isAuthorized } from "@/lib/auth";
import { isValidFormat } from "@/lib/emails";

export const runtime = "nodejs"; // nodemailer needs Node
export const maxDuration = 30;

type Body = { to?: string; subject?: string; body?: string; test?: boolean };

// Sends exactly ONE plain-text email per request
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Wrong app password" }, { status: 401 });
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, ""); // remove spaces
  if (!user || !pass) {
    return NextResponse.json(
      { error: "Server is missing GMAIL_USER or GMAIL_APP_PASSWORD" },
      { status: 500 }
    );
  }

  const data = (await req.json().catch(() => ({}))) as Body;
  const subject = (data.subject ?? "").replace(/[\r\n]+/g, " ").trim(); // no line breaks
  const text = data.body ?? "";
  if (!subject || !text.trim()) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  }

  // A test email always goes to your own Gmail
  const to = data.test ? user : (data.to ?? "").trim();
  if (!isValidFormat(to)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: { name: process.env.SENDER_NAME ?? "", address: user },
      to,
      subject,
      text, // plain text only
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    return NextResponse.json({ error: message.slice(0, 200) }, { status: 502 });
  }
}
