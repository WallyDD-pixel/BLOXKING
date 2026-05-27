import { dbQueryOne } from "@/lib/db/query";
import { sendAppEmail } from "@/lib/notifications/email-send";
import {
  templateDisputeChat,
  templateDisputeTicket,
} from "@/lib/notifications/email-templates";

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
  return { to: null as string | null, toLabel: null as string | null, authorIsA };
}

export async function notifyDisputeChatEmail(params: {
  matchId: string;
  authorId: string;
  message: string;
}) {
  const match = await getMatchParticipantsEmails(params.matchId);
  if (!match) return;

  const link = `${siteBaseUrl()}/play/match/${params.matchId}`;
  const cleanMsg = safeText(params.message, 900);

  const aLabel = match.label_a ?? match.display_a ?? "Joueur A";
  const bLabel = match.label_b ?? match.display_b ?? "Joueur B";
  const authorLabel = params.authorId === match.player_a ? aLabel : bLabel;

  const recipient = resolveRecipient(match, params.authorId);
  const subject = "BloXKING — nouveau message de litige";
  const tpl = templateDisputeChat({
    authorLabel,
    message: cleanMsg,
    matchUrl: link,
  });

  if (recipient?.to) {
    await sendAppEmail({ to: recipient.to, subject, text: tpl.text, html: tpl.html });
  } else {
    await sendAppEmail({ to: match.email_a, subject, text: tpl.text, html: tpl.html });
    await sendAppEmail({ to: match.email_b, subject, text: tpl.text, html: tpl.html });
  }
}

export async function notifyDisputeTicketEmail(params: {
  matchId: string;
  authorId: string;
  explanation: string;
}) {
  const match = await getMatchParticipantsEmails(params.matchId);
  if (!match) return;

  const link = `${siteBaseUrl()}/play/match/${params.matchId}`;
  const cleanExplanation = safeText(params.explanation, 900);

  const aLabel = match.label_a ?? match.display_a ?? "Joueur A";
  const bLabel = match.label_b ?? match.display_b ?? "Joueur B";
  const authorLabel = params.authorId === match.player_a ? aLabel : bLabel;

  const recipient = resolveRecipient(match, params.authorId);
  const subject = "BloXKING — nouveau ticket de litige";
  const tpl = templateDisputeTicket({
    authorLabel,
    explanation: cleanExplanation,
    matchUrl: link,
  });

  if (recipient?.to) {
    await sendAppEmail({ to: recipient.to, subject, text: tpl.text, html: tpl.html });
  } else {
    await sendAppEmail({ to: match.email_a, subject, text: tpl.text, html: tpl.html });
    await sendAppEmail({ to: match.email_b, subject, text: tpl.text, html: tpl.html });
  }
}
