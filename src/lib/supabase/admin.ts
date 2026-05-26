import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { mapMatchRpcError } from "@/lib/match-rpc-errors";

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: string }).message);
  }
  return "Erreur inconnue";
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function labelFromUser(u: User | null): string {
  if (!u) return "Joueur";
  const meta = u.user_metadata as { roblox_username?: string } | undefined;
  return meta?.roblox_username ?? u.email?.split("@")[0] ?? "Joueur";
}

function robloxFromUser(u: User | null): string | null {
  if (!u) return null;
  const meta = u.user_metadata as { roblox_username?: string } | undefined;
  const v = meta?.roblox_username?.trim();
  return v && v.length > 0 ? v : null;
}

export async function enrichMatchLabels(matchId: string): Promise<void> {
  const admin = getServiceClient();
  if (!admin) return;

  const { data: m, error } = await admin
    .from("matches")
    .select("id, player_a, player_b")
    .eq("id", matchId)
    .maybeSingle();

  if (error || !m) return;

  const [ra, rb] = await Promise.all([
    admin.auth.admin.getUserById(m.player_a),
    admin.auth.admin.getUserById(m.player_b),
  ]);

  const la = labelFromUser(ra.data?.user ?? null);
  const lb = labelFromUser(rb.data?.user ?? null);
  const raRoblox = robloxFromUser(ra.data?.user ?? null);
  const rbRoblox = robloxFromUser(rb.data?.user ?? null);

  const full = await admin
    .from("matches")
    .update({
      player_a_label: la,
      player_b_label: lb,
      player_a_roblox: raRoblox,
      player_b_roblox: rbRoblox,
    })
    .eq("id", matchId);

  if (full.error) {
    await admin
      .from("matches")
      .update({ player_a_label: la, player_b_label: lb })
      .eq("id", matchId);
  }
}

/** Même logique que la RPC `join_ranked_queue` (approx. sans FOR UPDATE SKIP LOCKED côté JS). */
export type JoinQueueServiceResult =
  | { ok: true; matched: false }
  | { ok: true; matched: true; matchId: string; opponentId: string }
  | { error: string };

async function countOpenMatchesForUser(
  admin: Exclude<ReturnType<typeof getServiceClient>, null>,
  userId: string,
): Promise<number> {
  const { count, error } = await admin
    .from("matches")
    .select("*", { count: "exact", head: true })
    .or(`player_a.eq.${userId},player_b.eq.${userId}`)
    .in("status", ["pending", "disputed"]);
  if (error) return 0;
  return count ?? 0;
}

function sleepRandomJitterMs(): Promise<void> {
  const ms = Math.floor(Math.random() * 41);
  return new Promise((r) => setTimeout(r, ms));
}

export async function joinRankedQueueViaService(
  uid: string,
): Promise<JoinQueueServiceResult | null> {
  const admin = getServiceClient();
  if (!admin) return null;

  await sleepRandomJitterMs();

  const { data: coolRow } = await admin
    .from("player_ranked_stats")
    .select("queue_available_after")
    .eq("user_id", uid)
    .maybeSingle();

  const coolUntil = coolRow?.queue_available_after
    ? new Date(String(coolRow.queue_available_after)).getTime()
    : 0;
  if (coolUntil > Date.now()) {
    return { error: mapMatchRpcError("queue_cooldown") };
  }

  if ((await countOpenMatchesForUser(admin, uid)) > 0) {
    return {
      error:
        "Tu as déjà un match en cours. Termine-le avant de relancer une recherche.",
    };
  }

  const sinceIso = new Date(Date.now() - 60_000).toISOString();
  const { count: rpcCount, error: rpcCountErr } = await admin
    .from("matchmaking_rpc_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", uid)
    .gte("created_at", sinceIso);

  if (rpcCountErr) return { error: errMsg(rpcCountErr) };
  if ((rpcCount ?? 0) >= 72) {
    return { error: mapMatchRpcError("rate_limited") };
  }

  const { error: logInsErr } = await admin
    .from("matchmaking_rpc_log")
    .insert({ user_id: uid });
  if (logInsErr) return { error: errMsg(logInsErr) };

  void admin
    .from("matchmaking_rpc_log")
    .delete()
    .lt("created_at", new Date(Date.now() - 3 * 3600_000).toISOString());

  const { data: stats } = await admin
    .from("player_ranked_stats")
    .select("elo, placement_matches_played")
    .eq("user_id", uid)
    .maybeSingle();

  let elo = 1000;
  let pl = 0;
  if (stats) {
    elo = Number(stats.elo);
    pl = Number(stats.placement_matches_played);
    if (!Number.isFinite(elo)) elo = 1000;
    if (!Number.isFinite(pl)) pl = 0;
  }

  const now = new Date().toISOString();

  const { data: existingQ } = await admin
    .from("match_queue")
    .select("user_id")
    .eq("user_id", uid)
    .maybeSingle();

  if (existingQ) {
    const { error: upErr } = await admin
      .from("match_queue")
      .update({ created_at: now, last_seen_at: now })
      .eq("user_id", uid);
    if (upErr) return { error: errMsg(upErr) };
  } else {
    const { error: upErr } = await admin.from("match_queue").insert({
      user_id: uid,
      created_at: now,
      first_queued_at: now,
      last_seen_at: now,
      elo_snapshot: elo,
      placement_snapshot: pl,
    });
    if (upErr) return { error: errMsg(upErr) };
  }

  const { data: myRow, error: myErr } = await admin
    .from("match_queue")
    .select("first_queued_at, elo_snapshot, placement_snapshot")
    .eq("user_id", uid)
    .single();

  if (myErr || !myRow) {
    return { error: errMsg(myErr ?? "File introuvable après inscription.") };
  }

  const firstMs = new Date(String(myRow.first_queued_at)).getTime();
  const waitSec = Math.max(0, (Date.now() - firstMs) / 1000);
  const span = Math.min(800, 50 + Math.floor(waitSec / 15) * 25);

  const myEloSnap = Number(myRow.elo_snapshot);
  const myPlSnap = Number(myRow.placement_snapshot);

  const { data: candidates, error: candErr } = await admin
    .from("match_queue")
    .select("user_id, elo_snapshot, placement_snapshot, first_queued_at")
    .neq("user_id", uid)
    .order("first_queued_at", { ascending: true })
    .limit(120);

  if (candErr) return { error: errMsg(candErr) };

  let partner: string | null = null;
  for (const row of candidates ?? []) {
    const pid = String(row.user_id);
    if ((await countOpenMatchesForUser(admin, pid)) > 0) {
      await admin.from("match_queue").delete().eq("user_id", pid);
      continue;
    }
    const oppElo = Number(row.elo_snapshot);
    const oppPl = Number(row.placement_snapshot);
    if (Math.abs(oppElo - myEloSnap) > span) continue;
    if (
      !(
        (myPlSnap < 5 && oppPl < 5) ||
        (myPlSnap >= 5 && oppPl >= 5)
      )
    ) {
      continue;
    }
    partner = pid;
    break;
  }

  if (!partner) {
    return { ok: true, matched: false };
  }

  if ((await countOpenMatchesForUser(admin, partner)) > 0) {
    await admin.from("match_queue").delete().eq("user_id", partner);
    return { ok: true, matched: false };
  }

  const { error: delErr } = await admin
    .from("match_queue")
    .delete()
    .in("user_id", [uid, partner]);
  if (delErr) return { error: errMsg(delErr) };

  const pa = uid < partner ? uid : partner;
  const pb = uid < partner ? partner : uid;

  const { data: inserted, error: insErr } = await admin
    .from("matches")
    .insert({
      player_a: pa,
      player_b: pb,
      source: "queue",
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr) return { error: errMsg(insErr) };
  if (!inserted?.id) return { error: "Match non créé" };

  return {
    ok: true,
    matched: true,
    matchId: inserted.id,
    opponentId: partner,
  };
}
