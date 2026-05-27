import { sendEmailSmtp } from "@/lib/notifications/email-smtp";

function mailFrom(): string | null {
  const from =
    process.env.DISPUTE_EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    "";
  return from || null;
}

export async function sendAppEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const from = mailFrom();
  const to = options.to.trim();
  if (!from || !to) return;

  const result = await sendEmailSmtp({
    from,
    to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.warn("[mail]", result.error);
  }
}
