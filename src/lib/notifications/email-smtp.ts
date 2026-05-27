import nodemailer from "nodemailer";

export type SmtpSendEmailInput = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function getTransport() {
  const host = env("SMTP_HOST");
  const portRaw = env("SMTP_PORT");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");

  if (!host || !portRaw) {
    return null;
  }

  const port = Number(portRaw);
  const secure =
    env("SMTP_SECURE")?.toLowerCase() === "true" || port === 465;

  // Si tu utilises un serveur sans auth (rare), user/pass peuvent être vides.
  const auth =
    user && pass
      ? {
          user,
          pass,
        }
      : undefined;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
  });
}

/** Envoi "best-effort" via SMTP (ne lève pas si mal configuré). */
export async function sendEmailSmtp(
  input: SmtpSendEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const transport = getTransport();
  if (!transport) {
    return { ok: false, error: "SMTP_HOST/SMTP_PORT manquants" };
  }

  const from = input.from.trim();
  const to = input.to.trim();
  if (!from || !to) return { ok: false, error: "From/To invalides" };

  try {
    await transport.sendMail({
      from,
      to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

