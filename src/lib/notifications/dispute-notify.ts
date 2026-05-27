import { dbQueryOne } from "@/lib/db/query";
import { sendEmailSmtp } from "@/lib/notifications/email-smtp";

function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function safeText(input: string, maxLen = 800): string {
  const s = input.normalize("NFC").replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "…";
}

async function getMatchParticipantsEmails(matchId: string) {
  return dbQueryOne<{
    player_a: string;
    player_b: string;
    email_a: string;
    email_b: string;
    label_a: string | null;
    label_b: string | null;
    display_a: string | null;
    display_b: string | null;
  }>(
    `
    select
      m.player_a,
      m.player_b,
      ua.email as email_a,
      ub.email as email_b,
      ua.roblox_username as label_a,
      ub.roblox_username as label_b,
      ua.display_name as display_a,
      ub.display_name as display_b
    from public.matches m
    join public.users ua on ua.id = m.player_a
    join public.users ub on ub.id = m.player_b
    where m.id = $1
    `,
    [matchId],
  );
}

function resolveRecipient(
  match: Awaited<ReturnType<typeof getMatchParticipantsEmails>>,
  authorId: string,
) {
  if (!match) return null;
  const authorIsA = match.player_a === authorId;
  if (authorIsA) {
    return { to: match.email_b, toLabel: match.label_b, authorIsA };
  }
  const authorIsB = match.player_b === authorId;
  if (authorIsB) {
    return { to: match.email_a, toLabel: match.label_a, authorIsA };
  }
  // Si on ne reconnaît pas l’auteur (cas admin), on prévient les 2.
  return { to: null as string | null, toLabel: null as string | null, authorIsA };
}

async function sendDisputeEmailToOne(options: {
  to: string;
  subject: string;
  text: string;
}) {
  const from =
    process.env.DISPUTE_EMAIL_FROM ??
    process.env.SMTP_FROM ??
    "";

  if (!from) return;
  const to = options.to.trim();
  if (!to) return;

  const result = await sendEmailSmtp({
    from,
    to,
    subject: options.subject,
    text: options.text,
  });

  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.warn("[mail] dispute email failed", result.error);
  }
}

export async function notifyDisputeChatEmail(params: {
  matchId: string;
  authorId: string;
  message: string;
}) {
  const match = await getMatchParticipantsEmails(params.matchId);
  if (!match) return;

  const base = siteBaseUrl();
  const link = `${base}/play/match/${params.matchId}`;
  const cleanMsg = safeText(params.message, 900);

  const aLabel = match.label_a ?? match.display_a ?? "Joueur A";
  const bLabel = match.label_b ?? match.display_b ?? "Joueur B";
  const authorLabel = params.authorId === match.player_a ? aLabel : bLabel;

  const recipient = resolveRecipient(match, params.authorId);
  const subject = "BloXKING — nouveau message de litige";
  const text = `Tu as un nouveau message de litige.\n\nAuteur : ${authorLabel}\nMessage : ${cleanMsg}\n\nOuvrir le litige : ${link}`;

  if (recipient?.to) {
    await sendDisputeEmailToOne({ to: recipient.to, subject, text });
  } else {
    // fallback (admin qui n’est pas participant)
    await sendDisputeEmailToOne({ to: match.email_a, subject, text });
    await sendDisputeEmailToOne({ to: match.email_b, subject, text });
  }
}

export async function notifyDisputeTicketEmail(params: {
  matchId: string;
  authorId: string;
  explanation: string;
}) {
  const match = await getMatchParticipantsEmails(params.matchId);
  if (!match) return;

  const base = siteBaseUrl();
  const link = `${base}/play/match/${params.matchId}`;
  const cleanExplanation = safeText(params.explanation, 900);

  const aLabel = match.label_a ?? match.display_a ?? "Joueur A";
  const bLabel = match.label_b ?? match.display_b ?? "Joueur B";
  const authorLabel = params.authorId === match.player_a ? aLabel : bLabel;

  const recipient = resolveRecipient(match, params.authorId);
  const subject = "BloXKING — nouveau ticket de litige";
  const text = `Un nouveau ticket de litige a été créé.\n\nAuteur : ${authorLabel}\nDétail : ${cleanExplanation}\n\nOuvrir le litige : ${link}`;

  if (recipient?.to) {
    await sendDisputeEmailToOne({ to: recipient.to, subject, text });
  } else {
    await sendDisputeEmailToOne({ to: match.email_a, subject, text });
    await sendDisputeEmailToOne({ to: match.email_b, subject, text });
  }
}

