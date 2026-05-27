export type BloxkingEmailLayoutOptions = {
  preheader: string;
  badge?: string;
  badgeTone?: "amber" | "emerald" | "red" | "sky";
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerNote?: string;
};

const TONE_COLORS = {
  amber: { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.45)", text: "#fcd34d" },
  emerald: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.45)", text: "#6ee7b7" },
  red: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.4)", text: "#fca5a5" },
  sky: { bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.4)", text: "#7dd3fc" },
};

/** Mise en page email HTML — palette BloXKING (fond sombre, accent ambre). */
export function bloxkingEmailLayout(opts: BloxkingEmailLayoutOptions): {
  html: string;
  text: string;
} {
  const tone = TONE_COLORS[opts.badgeTone ?? "amber"];
  const badge = opts.badge
    ? `<span style="display:inline-block;padding:6px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;background:${tone.bg};border:1px solid ${tone.border};color:${tone.text};">${escapeHtml(opts.badge)}</span>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#050506;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050506;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:20px;text-align:center;">
              <div style="font-size:28px;font-weight:800;letter-spacing:0.14em;color:#fafafa;font-family:Impact,'Arial Black',sans-serif;">
                <span style="color:#fbbf24;">BLOX</span><span style="color:#fafafa;">KING</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(180deg,#18181b 0%,#0c0c0e 100%);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px 24px;box-shadow:0 0 48px rgba(245,158,11,0.08);">
              ${badge ? `<div style="margin-bottom:16px;">${badge}</div>` : ""}
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#fafafa;font-weight:700;">${escapeHtml(opts.title)}</h1>
              <div style="font-size:15px;line-height:1.6;color:#a1a1aa;">${opts.bodyHtml}</div>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px;">
                <tr>
                  <td style="border-radius:10px;background:linear-gradient(180deg,#fbbf24 0%,#f59e0b 100%);">
                    <a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#09090b;text-decoration:none;">${escapeHtml(opts.ctaLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;text-align:center;font-size:12px;line-height:1.5;color:#71717a;">
              ${escapeHtml(opts.footerNote ?? "BloXKING — ladder 1v1 classé · Ne réponds pas à cet e-mail automatique.")}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = stripHtmlForPlainText(opts);

  return { html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtmlForPlainText(opts: BloxkingEmailLayoutOptions): string {
  const plain = [
    "BLOXKING",
    opts.badge ? `[${opts.badge}]` : "",
    opts.title,
    "",
    opts.preheader,
    "",
    `${opts.ctaLabel}: ${opts.ctaUrl}`,
    "",
    opts.footerNote ?? "BloXKING — ladder 1v1 classé",
  ]
    .filter(Boolean)
    .join("\n");
  return plain;
}

export function templateDisputeChat(params: {
  authorLabel: string;
  message: string;
  matchUrl: string;
}) {
  return bloxkingEmailLayout({
    preheader: `Nouveau message de litige de ${params.authorLabel}`,
    badge: "Litige",
    badgeTone: "amber",
    title: "Nouveau message sur ton match",
    bodyHtml: `<p style="margin:0 0 12px;"><strong style="color:#e4e4e7;">${escapeHtml(params.authorLabel)}</strong> a écrit :</p>
<blockquote style="margin:0;padding:12px 14px;border-left:3px solid #f59e0b;background:rgba(0,0,0,0.25);border-radius:8px;color:#d4d4d8;">${escapeHtml(params.message)}</blockquote>`,
    ctaLabel: "Ouvrir le litige",
    ctaUrl: params.matchUrl,
  });
}

export function templateDisputeTicket(params: {
  authorLabel: string;
  explanation: string;
  matchUrl: string;
}) {
  return bloxkingEmailLayout({
    preheader: "Un ticket de litige a été ouvert",
    badge: "Litige",
    badgeTone: "amber",
    title: "Nouveau ticket de litige",
    bodyHtml: `<p style="margin:0 0 12px;"><strong style="color:#e4e4e7;">${escapeHtml(params.authorLabel)}</strong> a soumis un ticket :</p>
<blockquote style="margin:0;padding:12px 14px;border-left:3px solid #f59e0b;background:rgba(0,0,0,0.25);border-radius:8px;color:#d4d4d8;">${escapeHtml(params.explanation)}</blockquote>`,
    ctaLabel: "Voir le litige",
    ctaUrl: params.matchUrl,
  });
}

export function templateMatchResult(params: {
  won: boolean;
  scoreLine: string;
  opponentLabel: string;
  lpDelta: number | null;
  matchUrl: string;
}) {
  const won = params.won;
  const lp =
    params.lpDelta != null
      ? `${params.lpDelta > 0 ? "+" : ""}${params.lpDelta} LP`
      : null;

  const title = won ? "Victoire !" : "Défaite";
  const badge = won ? "Victoire" : "Défaite";
  const tone = won ? "emerald" : "red";

  const bodyParts = [
    `<p style="margin:0 0 12px;">Match contre <strong style="color:#e4e4e7;">${escapeHtml(params.opponentLabel)}</strong></p>`,
    `<p style="margin:0;font-size:18px;font-weight:700;color:${won ? "#6ee7b7" : "#fca5a5"};">Score : ${escapeHtml(params.scoreLine)}</p>`,
  ];
  if (lp) {
    bodyParts.push(
      `<p style="margin:12px 0 0;font-size:16px;color:#fbbf24;">Classement : <strong>${escapeHtml(lp)}</strong></p>`,
    );
  }

  return bloxkingEmailLayout({
    preheader: won
      ? `Victoire ${params.scoreLine}${lp ? ` · ${lp}` : ""}`
      : `Défaite ${params.scoreLine}${lp ? ` · ${lp}` : ""}`,
    badge,
    badgeTone: tone,
    title,
    bodyHtml: bodyParts.join(""),
    ctaLabel: "Voir le match",
    ctaUrl: params.matchUrl,
  });
}
