import {
  getSmtpDiagnostics,
  sendEmailSmtp,
  verifySmtpConnection,
} from "@/lib/notifications/email-smtp";
import { smtpFromAddress } from "@/lib/notifications/smtp-config";

export type SendAppEmailResult =
  | { ok: true }
  | { ok: false; error: string; skipped?: boolean };

export async function sendAppEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendAppEmailResult> {
  const from = smtpFromAddress();
  const to = options.to.trim();
  if (!from || !to) {
    return {
      ok: false,
      skipped: true,
      error: !from ? "SMTP_FROM manquant" : "Destinataire vide",
    };
  }

  const result = await sendEmailSmtp({
    from,
    to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error("[mail] échec envoi", {
      to,
      subject: options.subject,
      error: result.error,
    });
    return { ok: false, error: result.error };
  }

  return { ok: true };
}

export async function sendSmtpTestEmail(to: string): Promise<SendAppEmailResult> {
  const verify = await verifySmtpConnection();
  if (!verify.ok) return verify;

  return sendAppEmail({
    to,
    subject: "BloXKING — test SMTP",
    text: "Si tu reçois cet e-mail, la configuration SMTP fonctionne.",
    html: "<p>Si tu reçois cet e-mail, la <strong>configuration SMTP</strong> BloXKING fonctionne.</p>",
  });
}

export { getSmtpDiagnostics, verifySmtpConnection };
