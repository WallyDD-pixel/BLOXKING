import { dbQuery, dbQueryOne } from "@/lib/db/query";
import { expireStaleMatchesIfNeeded } from "@/lib/match/expire-stale-matches";
import {
  matchmakingBaseEloSpan,
  pickBestQueuePartner,
} from "@/lib/match/matchmaking-pairing";
import { loadRecentQueueOpponents } from "@/lib/match/recent-opponents";
import { mapMatchRpcError } from "@/lib/match-rpc-errors";

export type JoinQueueResult =
  | { ok: true; matched: false }
  | { ok: true; matched: true; matchId: string; opponentId: string }
  | { error: string };

function sleepRandomJitterMs(): Promise<void> {
  const ms = Math.floor(Math.random() * 41);
  return new Promise((r) => setTimeout(r, ms));
}

async function countOpenMatchesForUser(userId: string): Promise<number> {
  const row = await dbQueryOne<{ c: string }>(
    `
    select count(*)::text as c
    from public.matches m
    where (m.player_a = $1 or m.player_b = $1)
      and m.status in ('pending', 'disputed')
    `,
    [userId],
  );
  return Number(row?.c ?? 0);
}

export async function joinRankedQueue(uid: string): Promise<JoinQueueResult> {
  await sleepRandomJitterMs();
  await expireStaleMatchesIfNeeded();

  const coolRow = await dbQueryOne<{ queue_available_after: string | null }>(
    `select queue_available_after from public.player_ranked_stats where user_id = $1`,
    [uid],
  );
  const coolUntil = coolRow?.queue_available_after
    ? new Date(String(coolRow.queue_available_after)).getTime()
    : 0;
  if (coolUntil > Date.now()) {
    return { error: mapMatchRpcError("queue_cooldown") };
  }

  if ((await countOpenMatchesForUser(uid)) > 0) {
    return {
      error:
        "Tu as déjà un match en cours. Termine-le avant de relancer une recherche.",
    };
  }

  const sinceIso = new Date(Date.now() - 60_000).toISOString();
  const rpcCountRow = await dbQueryOne<{ c: string }>(
    `
    select count(*)::text as c
    from public.matchmaking_rpc_log
    where user_id = $1 and created_at >= $2::timestamptz
    `,
    [uid, sinceIso],
  );
  if (Number(rpcCountRow?.c ?? 0) >= 72) {
    return { error: mapMatchRpcError("rate_limited") };
  }

  await dbQueryOne(
    `insert into public.matchmaking_rpc_log (user_id) values ($1) returning id`,
    [uid],
  );
  await dbQuery(
    `delete from public.matchmaking_rpc_log where created_at < now() - interval '3 hours'`,
  );

  const stats = await dbQueryOne<{
    elo: number;
    placement_matches_played: number;
  }>(
    `select elo, placement_matches_played from public.player_ranked_stats where user_id = $1`,
    [uid],
  );

  let elo = 1000;
  let pl = 0;
  if (stats) {
    elo = Number(stats.elo);
    pl = Number(stats.placement_matches_played);
    if (!Number.isFinite(elo)) elo = 1000;
    if (!Number.isFinite(pl)) pl = 0;
  }

  const now = new Date().toISOString();
  const existingQ = await dbQueryOne<{ user_id: string }>(
    `select user_id from public.match_queue where user_id = $1`,
    [uid],
  );

  if (existingQ) {
    await dbQueryOne(
      `update public.match_queue set created_at = $2, last_seen_at = $2 where user_id = $1 returning user_id`,
      [uid, now],
    );
  } else {
    await dbQueryOne(
      `
      insert into public.match_queue (
        user_id, created_at, first_queued_at, last_seen_at, elo_snapshot, placement_snapshot
      ) values ($1, $2, $2, $2, $3, $4)
      returning user_id
      `,
      [uid, now, elo, pl],
    );
  }

  const myRow = await dbQueryOne<{
    first_queued_at: string;
    elo_snapshot: number;
    placement_snapshot: number;
  }>(
    `select first_queued_at, elo_snapshot, placement_snapshot from public.match_queue where user_id = $1`,
    [uid],
  );
  if (!myRow) return { error: "File introuvable après inscription." };

  const firstMs = new Date(String(myRow.first_queued_at)).getTime();
  const waitSec = Math.max(0, (Date.now() - firstMs) / 1000);
  const span = matchmakingBaseEloSpan(waitSec);
  const myEloSnap = Number(myRow.elo_snapshot);
  const myPlSnap = Number(myRow.placement_snapshot);

  const candidates = await dbQuery<{
    user_id: string;
    elo_snapshot: number;
    placement_snapshot: number;
    first_queued_at: string;
  }>(
    `
    select user_id, elo_snapshot, placement_snapshot, first_queued_at
    from public.match_queue
    where user_id <> $1
    order by first_queued_at asc
    limit 120
    `,
    [uid],
  );

  const eligible: typeof candidates = [];
  for (const row of candidates) {
    const pid = String(row.user_id);
    if ((await countOpenMatchesForUser(pid)) > 0) {
      await dbQuery(`delete from public.match_queue where user_id = $1`, [pid]);
      continue;
    }
    eligible.push(row);
  }

  const recentOpponents = await loadRecentQueueOpponents(uid);

  const partner = pickBestQueuePartner(
    myEloSnap,
    myPlSnap,
    span,
    eligible,
    recentOpponents,
    waitSec,
  );

  if (!partner) return { ok: true, matched: false };

  if ((await countOpenMatchesForUser(partner)) > 0) {
    await dbQuery(`delete from public.match_queue where user_id = $1`, [partner]);
    return { ok: true, matched: false };
  }

  await dbQuery(`delete from public.match_queue where user_id = any($1::uuid[])`, [
    [uid, partner],
  ]);

  const pa = uid < partner ? uid : partner;
  const pb = uid < partner ? partner : uid;

  const inserted = await dbQueryOne<{ id: string }>(
    `
    insert into public.matches (player_a, player_b, source, status)
    values ($1, $2, 'queue', 'pending')
    returning id
    `,
    [pa, pb],
  );
  if (!inserted?.id) return { error: "Match non créé" };

  return { ok: true, matched: true, matchId: inserted.id, opponentId: partner };
}
