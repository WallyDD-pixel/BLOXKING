export type ResendSendEmailInput = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
};

async function getResendApiKey(): Promise<string | null> {
  return process.env.RESEND_API_KEY?.trim() ? process.env.RESEND_API_KEY : null;
}

/** Envoi "best-effort" via Resend. Ne lève jamais d’erreur en prod si non configuré. */
export async function sendEmailResend(
  input: ResendSendEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = await getResendApiKey();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY manquante" };
  }

  const from = input.from.trim();
  const to = input.to.trim();
  if (!from || !to) return { ok: false, error: "From/To invalides" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Resend HTTP ${res.status}: ${body.slice(0, 500)}`,
      };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

