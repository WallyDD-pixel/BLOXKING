import { dbQueryOne } from "@/lib/db/query";
import { sendAppEmail } from "@/lib/notifications/email-send";
import { templateMatchResult } from "@/lib/notifications/email-templates";

function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function playerLabel(
  roblox: string | null,
  display: string | null,
  fallback: string,
): string {
  return roblox?.trim() || display?.trim() || fallback;
}

/** E-mails victoire / défaite après clôture du match (best-effort). */
export async function notifyMatchResultEmails(matchId: string): Promise<void> {
  const row = await dbQueryOne<{
    status: string;
    maps_a: number;
    maps_b: number;
    elo_delta_a: number | null;
    elo_delta_b: number | null;
    email_a: string;
    email_b: string;
    label_a: string | null;
    label_b: string | null;
    display_a: string | null;
    display_b: string | null;
  }>(
    `
    select
      m.status,
      m.claim_from_a_maps_a as maps_a,
      m.claim_from_a_maps_b as maps_b,
      m.elo_delta_a,
      m.elo_delta_b,
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

  if (!row || row.status !== "confirmed") return;
  if (row.maps_a == null || row.maps_b == null) return;

  const base = siteBaseUrl();
  const matchUrl = `${base}/play/match/${matchId}`;
  const aName = playerLabel(row.label_a, row.display_a, "Joueur A");
  const bName = playerLabel(row.label_b, row.display_b, "Joueur B");
  const scoreForA = `${row.maps_a}-${row.maps_b}`;
  const scoreForB = `${row.maps_b}-${row.maps_a}`;
  const aWon = row.maps_a > row.maps_b;

  const tplA = templateMatchResult({
    won: aWon,
    scoreLine: scoreForA,
    opponentLabel: bName,
    lpDelta: row.elo_delta_a,
    matchUrl,
  });
  await sendAppEmail({
    to: row.email_a,
    subject: aWon
      ? `BloXKING — Victoire ${scoreForA}`
      : `BloXKING — Défaite ${scoreForA}`,
    text: tplA.text,
    html: tplA.html,
  });

  const tplB = templateMatchResult({
    won: !aWon,
    scoreLine: scoreForB,
    opponentLabel: aName,
    lpDelta: row.elo_delta_b,
    matchUrl,
  });
  await sendAppEmail({
    to: row.email_b,
    subject: !aWon
      ? `BloXKING — Victoire ${scoreForB}`
      : `BloXKING — Défaite ${scoreForB}`,
    text: tplB.text,
    html: tplB.html,
  });
}
