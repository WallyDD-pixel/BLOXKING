import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { getSmtpConfig, getSmtpConfigIssues } from "@/lib/notifications/smtp-config";

export type SmtpSendEmailInput = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function createTransport() {
  const cfg = getSmtpConfig();
  if (!cfg) return null;

  const options: SMTPTransport.Options = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth:
      cfg.user && cfg.pass
        ? {
            user: cfg.user,
            pass: cfg.pass,
          }
        : undefined,
  };

  if (cfg.requireTls) {
    options.requireTLS = true;
  }

  return nodemailer.createTransport(options);
}

export function getSmtpDiagnostics(): {
  configured: boolean;
  issues: string[];
} {
  const issues = getSmtpConfigIssues();
  return {
    configured: issues.length === 0,
    issues,
  };
}

/** Vérifie la connexion SMTP (login). */
export async function verifySmtpConnection(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const issues = getSmtpConfigIssues();
  if (issues.length > 0) {
    return { ok: false, error: issues.join(" ") };
  }

  const transport = createTransport();
  if (!transport) {
    return { ok: false, error: "Transport SMTP non créé." };
  }

  try {
    await transport.verify();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  } finally {
    transport.close();
  }
}

export async function sendEmailSmtp(
  input: SmtpSendEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const issues = getSmtpConfigIssues();
  if (issues.length > 0) {
    return { ok: false, error: issues.join(" ") };
  }

  const transport = createTransport();
  if (!transport) {
    return { ok: false, error: "Transport SMTP non créé." };
  }

  const from = input.from.trim();
  const to = input.to.trim();
  if (!from || !to) return { ok: false, error: "From/To invalides" };

  try {
    const info = await transport.sendMail({
      from,
      to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    if (info.rejected?.length) {
      return {
        ok: false,
        error: `Destinataire refusé : ${info.rejected.join(", ")}`,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  } finally {
    transport.close();
  }
}
