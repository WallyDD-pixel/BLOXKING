import { dbQueryOne } from "@/lib/db/query";
import {
  createInAppNotification,
  createInAppNotificationsBulk,
} from "@/lib/notifications-inapp/service";

type MatchParticipants = {
  player_a: string;
  player_b: string;
  player_a_label: string | null;
  player_b_label: string | null;
  elo_delta_a: number | null;
  elo_delta_b: number | null;
};

async function getMatchParticipants(matchId: string): Promise<MatchParticipants | null> {
  return dbQueryOne<MatchParticipants>(
    `
    select
      player_a,
      player_b,
      player_a_label,
      player_b_label,
      elo_delta_a,
      elo_delta_b
    from public.matches
    where id = $1
    `,
    [matchId],
  );
}

function playerLabel(label: string | null, fallback: string) {
  return label?.trim() || fallback;
}

export async function notifyMatchResultInApp(matchId: string) {
  const match = await getMatchParticipants(matchId);
  if (!match) return;

  const aWon = Number(match.elo_delta_a ?? 0) > Number(match.elo_delta_b ?? 0);
  const titleA = aWon ? "Victoire confirmée" : "Défaite confirmée";
  const titleB = aWon ? "Défaite confirmée" : "Victoire confirmée";
  const bodyA = `Ton match contre ${playerLabel(match.player_b_label, "ton adversaire")} est finalisé.`;
  const bodyB = `Ton match contre ${playerLabel(match.player_a_label, "ton adversaire")} est finalisé.`;

  await createInAppNotificationsBulk([
    {
      userId: match.player_a,
      kind: "match_result",
      title: titleA,
      body: bodyA,
      href: `/play/match/${matchId}`,
      payload: { matchId },
    },
    {
      userId: match.player_b,
      kind: "match_result",
      title: titleB,
      body: bodyB,
      href: `/play/match/${matchId}`,
      payload: { matchId },
    },
  ]);
}

export async function notifyOtherPlayerDisputeMessageInApp(
  matchId: string,
  authorId: string,
  byAdmin = false,
) {
  const match = await getMatchParticipants(matchId);
  if (!match) return;
  const targetId = match.player_a === authorId ? match.player_b : match.player_a;
  const actor = byAdmin
    ? "Un admin"
    : match.player_a === authorId
      ? playerLabel(match.player_a_label, "Ton adversaire")
      : playerLabel(match.player_b_label, "Ton adversaire");

  await createInAppNotification({
    userId: targetId,
    kind: "dispute_message",
    title: "Nouveau message litige",
    body: `${actor} a envoyé un message dans le litige du match.`,
    href: `/play/match/${matchId}`,
    payload: { matchId, authorId, byAdmin },
  });
}

export async function notifyDisputeOpenedInApp(matchId: string, authorId: string) {
  const match = await getMatchParticipants(matchId);
  if (!match) return;
  const targetId = match.player_a === authorId ? match.player_b : match.player_a;
  await createInAppNotification({
    userId: targetId,
    kind: "dispute_opened",
    title: "Litige ouvert",
    body: "Ton adversaire a ouvert un litige sur le match.",
    href: `/play/match/${matchId}`,
    payload: { matchId, authorId },
  });
}

export async function notifyMatchCancelledInApp(matchId: string) {
  const match = await getMatchParticipants(matchId);
  if (!match) return;
  await createInAppNotificationsBulk([
    {
      userId: match.player_a,
      kind: "match_cancelled",
      title: "Match annulé",
      body: "Un admin a annulé ce match.",
      href: `/play/match/${matchId}`,
      payload: { matchId },
    },
    {
      userId: match.player_b,
      kind: "match_cancelled",
      title: "Match annulé",
      body: "Un admin a annulé ce match.",
      href: `/play/match/${matchId}`,
      payload: { matchId },
    },
  ]);
}
