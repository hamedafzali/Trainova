import nodemailer, { type Transporter } from "nodemailer";

// Email sending, gated on SMTP_HOST. When unset, password reset falls back to
// "ask an admin" rather than silently failing.
export function isMailEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

let transport: Transporter | null = null;
function getTransport(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transport;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const t = getTransport();
  if (!t) throw new Error("Mail not configured");
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@trainova",
    to,
    subject,
    html,
  });
}

/** Public app URL for building links (env, else the request's forwarded host). */
export function appUrl(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}
