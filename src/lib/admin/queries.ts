import { dbQuery, dbQueryOne } from "@/lib/db/query";
import { PRESENCE_ONLINE_MINUTES } from "@/lib/presence/constants";

export type AdminStats = {
  users_total: number;
  users_online: number;
  matches_total: number;
  matches_active: number;
  matches_disputed: number;
  matches_confirmed: number;
  presence_window_minutes: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  const row = await dbQueryOne<AdminStats>(
    `
    select
      (select count(*)::int from public.users) as users_total,
      (select count(*)::int from public.users
        where last_seen_at > now() - ($1::int * interval '1 minute')) as users_online,
      (select count(*)::int from public.matches) as matches_total,
      (select count(*)::int from public.matches
        where status in ('pending', 'disputed')) as matches_active,
      (select count(*)::int from public.matches
        where status = 'disputed' or dispute = true) as matches_disputed,
      (select count(*)::int from public.matches
        where status = 'confirmed') as matches_confirmed
    `,
    [PRESENCE_ONLINE_MINUTES],
  );
  const base = row ?? {
    users_total: 0,
    users_online: 0,
    matches_total: 0,
    matches_active: 0,
    matches_disputed: 0,
    matches_confirmed: 0,
  };
  return {
    ...base,
    presence_window_minutes: PRESENCE_ONLINE_MINUTES,
  };
}

export type AdminOnlineUserRow = {
  id: string;
  email: string;
  display_name: string | null;
  roblox_username: string | null;
  last_seen_at: string;
  last_seen_path: string | null;
};

export async function getAdminOnlineUsers(): Promise<AdminOnlineUserRow[]> {
  try {
    return dbQuery<AdminOnlineUserRow>(
      `
      select
        id,
        email,
        display_name,
        roblox_username,
        last_seen_at,
        last_seen_path
      from public.users
      where last_seen_at > now() - ($1::int * interval '1 minute')
      order by last_seen_at desc
      limit 100
      `,
      [PRESENCE_ONLINE_MINUTES],
    );
  } catch {
    return [];
  }
}

export type AdminMatchRow = {
  id: string;
  status: string;
  source: string;
  created_at: string;
  dispute: boolean;
  cancel_reason: string | null;
  match_started_a: boolean;
  match_started_b: boolean;
  player_a: string;
  player_b: string;
  player_a_email: string;
  player_b_email: string;
  player_a_roblox_username: string | null;
  player_b_roblox_username: string | null;
  player_a_display_name: string | null;
  player_b_display_name: string | null;
  player_a_label: string | null;
  player_b_label: string | null;
  claim_from_a_maps_a: number | null;
  claim_from_a_maps_b: number | null;
  claim_from_b_maps_a: number | null;
  claim_from_b_maps_b: number | null;
  ticket_count: number;
  cancel_request_count: number;
  player_chat_count: number;
};

const ADMIN_MATCH_SELECT = `
  m.id, m.status, m.source, m.created_at,
  coalesce(m.dispute, false) as dispute,
  m.cancel_reason,
  coalesce(m.match_started_a, false) as match_started_a,
  coalesce(m.match_started_b, false) as match_started_b,
  m.player_a, m.player_b,
  ua.email as player_a_email,
  ub.email as player_b_email,
  ua.roblox_username as player_a_roblox_username,
  ub.roblox_username as player_b_roblox_username,
  ua.display_name as player_a_display_name,
  ub.display_name as player_b_display_name,
  m.player_a_label, m.player_b_label,
  m.claim_from_a_maps_a, m.claim_from_a_maps_b,
  m.claim_from_b_maps_a, m.claim_from_b_maps_b,
  coalesce(t.cnt, 0)::int as ticket_count,
  coalesce(cr.cnt, 0)::int as cancel_request_count,
  coalesce(ch.cnt, 0)::int as player_chat_count
`;

export async function listAdminMatches(options: {
  status?: string;
  limit?: number;
}): Promise<AdminMatchRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 80, 1), 200);
  const status = options.status?.trim();

  if (status && status !== "all") {
    return dbQuery<AdminMatchRow>(
      `
      select ${ADMIN_MATCH_SELECT}
      from public.matches m
      join public.users ua on ua.id = m.player_a
      join public.users ub on ub.id = m.player_b
      left join (
        select match_id, count(*)::int as cnt
        from public.match_dispute_tickets
        group by match_id
      ) t on t.match_id = m.id
      left join (
        select match_id, count(*)::int as cnt
        from public.match_cancellation_requests
        where status = 'open'
        group by match_id
      ) cr on cr.match_id = m.id
      left join (
        select c.match_id, count(*)::int as cnt
        from public.match_dispute_chat_messages c
        join public.users u on u.id = c.author_id
        where coalesce(u.is_admin, false) = false
        group by c.match_id
      ) ch on ch.match_id = m.id
      where m.status = $1
      order by m.created_at desc
      limit $2
      `,
      [status, limit],
    );
  }

  return dbQuery<AdminMatchRow>(
    `
    select ${ADMIN_MATCH_SELECT}
    from public.matches m
    join public.users ua on ua.id = m.player_a
    join public.users ub on ub.id = m.player_b
    left join (
      select match_id, count(*)::int as cnt
      from public.match_dispute_tickets
      group by match_id
    ) t on t.match_id = m.id
    left join (
      select match_id, count(*)::int as cnt
      from public.match_cancellation_requests
      where status = 'open'
      group by match_id
    ) cr on cr.match_id = m.id
    left join (
      select c.match_id, count(*)::int as cnt
      from public.match_dispute_chat_messages c
      join public.users u on u.id = c.author_id
      where coalesce(u.is_admin, false) = false
      group by c.match_id
    ) ch on ch.match_id = m.id
    order by m.created_at desc
    limit $1
    `,
    [limit],
  );
}

export type AdminDisputeRow = {
  match_id: string;
  status: string;
  created_at: string;
  player_a_email: string;
  player_b_email: string;
  player_a_roblox_username: string | null;
  player_b_roblox_username: string | null;
  player_a_display_name: string | null;
  player_b_display_name: string | null;
  player_a_label: string | null;
  player_b_label: string | null;
  ticket_count: number;
  first_ticket_at: string | null;
  chat_count: number;
  last_decision_at: string | null;
  last_decision_action: string | null;
  last_decision_maps_a: number | null;
  last_decision_maps_b: number | null;
};

const ADMIN_DISPUTE_LIST_SELECT = `
  m.id as match_id,
  m.status,
  m.created_at,
  ua.email as player_a_email,
  ub.email as player_b_email,
  ua.roblox_username as player_a_roblox_username,
  ub.roblox_username as player_b_roblox_username,
  ua.display_name as player_a_display_name,
  ub.display_name as player_b_display_name,
  m.player_a_label,
  m.player_b_label,
  coalesce(t.cnt, 0)::int as ticket_count,
  t.first_at as first_ticket_at,
  coalesce(c.cnt, 0)::int as chat_count,
  d.last_at as last_decision_at,
  d.last_action as last_decision_action,
  d.last_maps_a as last_decision_maps_a,
  d.last_maps_b as last_decision_maps_b
`;

const ADMIN_DISPUTE_DECISIONS_LATERAL = `
  left join lateral (
    select
      dec.created_at as last_at,
      dec.action as last_action,
      dec.maps_a as last_maps_a,
      dec.maps_b as last_maps_b
    from public.match_dispute_admin_decisions dec
    where dec.match_id = m.id
    order by dec.created_at desc
    limit 1
  ) d on true
`;

export async function listAdminDisputesOpen(): Promise<AdminDisputeRow[]> {
  return dbQuery<AdminDisputeRow>(
    `
    select ${ADMIN_DISPUTE_LIST_SELECT}
    from public.matches m
    join public.users ua on ua.id = m.player_a
    join public.users ub on ub.id = m.player_b
    left join (
      select match_id, count(*)::int as cnt, min(created_at) as first_at
      from public.match_dispute_tickets
      group by match_id
    ) t on t.match_id = m.id
    left join (
      select match_id, count(*)::int as cnt
      from public.match_dispute_chat_messages
      group by match_id
    ) c on c.match_id = m.id
    ${ADMIN_DISPUTE_DECISIONS_LATERAL}
    where m.status = 'disputed' or m.dispute = true
    order by coalesce(t.first_at, m.created_at) desc
  `,
  );
}

/** Litiges traités (score validé ou annulé par la modération). */
export async function listAdminDisputesClosed(
  limit = 80,
): Promise<AdminDisputeRow[]> {
  const lim = Math.min(Math.max(limit, 1), 200);
  return dbQuery<AdminDisputeRow>(
    `
    select ${ADMIN_DISPUTE_LIST_SELECT}
    from public.matches m
    join public.users ua on ua.id = m.player_a
    join public.users ub on ub.id = m.player_b
    left join (
      select match_id, count(*)::int as cnt, min(created_at) as first_at
      from public.match_dispute_tickets
      group by match_id
    ) t on t.match_id = m.id
    left join (
      select match_id, count(*)::int as cnt
      from public.match_dispute_chat_messages
      group by match_id
    ) c on c.match_id = m.id
    ${ADMIN_DISPUTE_DECISIONS_LATERAL}
    where m.status in ('confirmed', 'cancelled')
      and (
        exists (
          select 1
          from public.match_dispute_admin_decisions dec0
          where dec0.match_id = m.id
        )
        or coalesce(t.cnt, 0) > 0
        or coalesce(m.manual_dispute, false) = true
      )
    order by coalesce(d.last_at, t.first_at, m.created_at) desc
    limit $1
    `,
    [lim],
  );
}

export type AdminDisputeDecisionRow = {
  id: string;
  action: string;
  maps_a: number | null;
  maps_b: number | null;
  previous_status: string;
  new_status: string;
  note: string | null;
  created_at: string;
  admin_email: string;
  admin_roblox_username: string | null;
  admin_display_name: string | null;
};

export async function listAdminDisputeDecisions(
  matchId: string,
): Promise<AdminDisputeDecisionRow[]> {
  return dbQuery<AdminDisputeDecisionRow>(
    `
    select
      d.id,
      d.action,
      d.maps_a,
      d.maps_b,
      d.previous_status,
      d.new_status,
      d.note,
      d.created_at,
      u.email as admin_email,
      u.roblox_username as admin_roblox_username,
      u.display_name as admin_display_name
    from public.match_dispute_admin_decisions d
    join public.users u on u.id = d.admin_id
    where d.match_id = $1
    order by d.created_at desc
    `,
    [matchId],
  );
}

/** @deprecated Utiliser listAdminDisputesOpen */
export async function listAdminDisputes(): Promise<AdminDisputeRow[]> {
  return listAdminDisputesOpen();
}

export type AdminUserRow = {
  id: string;
  email: string;
  display_name: string | null;
  roblox_username: string | null;
  created_at: string;
  is_admin: boolean;
  is_dispute_moderator: boolean;
  elo: number | null;
  placement_matches_played: number | null;
  matches_total: number;
  matches_wins: number;
};

const ADMIN_USER_SELECT = `
  u.id,
  u.email,
  u.display_name,
  u.roblox_username,
  u.created_at,
  coalesce(u.is_admin, false) as is_admin,
  coalesce(u.is_dispute_moderator, false) as is_dispute_moderator,
  s.elo,
  s.placement_matches_played,
  coalesce(m.total, 0)::int as matches_total,
  coalesce(m.wins, 0)::int as matches_wins
`;

const ADMIN_USER_FROM = `
  from public.users u
  left join public.player_ranked_stats s on s.user_id = u.id
  left join lateral (
    select
      count(*)::int as total,
      count(*) filter (
        where
          (mt.player_a = u.id and coalesce(mt.elo_delta_a, 0) > 0)
          or (mt.player_b = u.id and coalesce(mt.elo_delta_b, 0) > 0)
      )::int as wins
    from public.matches mt
    where mt.status = 'confirmed'
      and (mt.player_a = u.id or mt.player_b = u.id)
  ) m on true
`;

export async function countAdminUsers(): Promise<number> {
  const row = await dbQueryOne<{ c: string }>(
    `select count(*)::text as c from public.users`,
  );
  return Number(row?.c ?? 0);
}

/** Derniers inscrits (liste par défaut). */
export async function listAdminUsers(limit = 100): Promise<AdminUserRow[]> {
  const lim = Math.min(Math.max(limit, 1), 500);
  return dbQuery<AdminUserRow>(
    `
    select ${ADMIN_USER_SELECT}
    ${ADMIN_USER_FROM}
    order by u.created_at desc
    limit $1
    `,
    [lim],
  );
}

/** Recherche dans toute la base (e-mail, pseudo, Roblox, id). */
export async function searchAdminUsers(
  query: string,
  limit = 80,
): Promise<AdminUserRow[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const lim = Math.min(Math.max(limit, 1), 200);
  const pattern = `%${trimmed.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  return dbQuery<AdminUserRow>(
    `
    select ${ADMIN_USER_SELECT}
    ${ADMIN_USER_FROM}
    where (
      u.email ilike $1
      or coalesce(u.display_name, '') ilike $1
      or coalesce(u.roblox_username, '') ilike $1
      or u.id::text ilike $1
    )
    order by
      case
        when lower(u.email) = lower($2) then 0
        when lower(coalesce(u.roblox_username, '')) = lower($2) then 1
        when lower(coalesce(u.display_name, '')) = lower($2) then 2
        else 3
      end,
      u.created_at desc
    limit $3
    `,
    [pattern, trimmed, lim],
  );
}

export type AdminMatchDetail = AdminMatchRow & {
  manual_dispute: boolean;
  match_started_a: boolean;
  match_started_b: boolean;
  elo_delta_a: number | null;
  elo_delta_b: number | null;
};

export async function getAdminMatchDetail(
  matchId: string,
): Promise<AdminMatchDetail | null> {
  return dbQueryOne<AdminMatchDetail>(
    `
    select
      ${ADMIN_MATCH_SELECT.trim()},
      coalesce(m.manual_dispute, false) as manual_dispute,
      m.elo_delta_a, m.elo_delta_b
    from public.matches m
    join public.users ua on ua.id = m.player_a
    join public.users ub on ub.id = m.player_b
    left join (
      select match_id, count(*)::int as cnt
      from public.match_dispute_tickets
      group by match_id
    ) t on t.match_id = m.id
    left join (
      select match_id, count(*)::int as cnt
      from public.match_cancellation_requests
      where status = 'open'
      group by match_id
    ) cr on cr.match_id = m.id
    left join (
      select c.match_id, count(*)::int as cnt
      from public.match_dispute_chat_messages c
      join public.users u on u.id = c.author_id
      where coalesce(u.is_admin, false) = false
      group by c.match_id
    ) ch on ch.match_id = m.id
    where m.id = $1
    `,
    [matchId],
  );
}

export type AdminTicketRow = {
  id: string;
  opened_by: string;
  opener_email: string;
  opener_roblox_username: string | null;
  opener_display_name: string | null;
  body: string;
  created_at: string;
  attachment_paths: string[];
};

export async function listAdminTickets(matchId: string): Promise<AdminTicketRow[]> {
  const rows = await dbQuery<{
    id: string;
    opened_by: string;
    opener_email: string;
    opener_roblox_username: string | null;
    opener_display_name: string | null;
    body: string;
    created_at: string;
    attachment_paths: string[] | null;
  }>(
    `
    select
      t.id,
      t.opened_by,
      u.email as opener_email,
      u.roblox_username as opener_roblox_username,
      u.display_name as opener_display_name,
      t.body,
      t.created_at,
      t.attachment_paths
    from public.match_dispute_tickets t
    join public.users u on u.id = t.opened_by
    where t.match_id = $1
    order by t.created_at asc
    `,
    [matchId],
  );
  return rows.map((r) => ({
    ...r,
    attachment_paths: r.attachment_paths ?? [],
  }));
}

export type AdminChatRow = {
  id: string;
  author_id: string;
  author_email: string;
  author_display_name: string | null;
  author_roblox_username: string | null;
  author_is_admin: boolean;
  body: string;
  created_at: string;
};

export async function listAdminChat(matchId: string): Promise<AdminChatRow[]> {
  return dbQuery<AdminChatRow>(
    `
    select
      c.id, c.author_id,
      u.email as author_email,
      u.display_name as author_display_name,
      u.roblox_username as author_roblox_username,
      coalesce(u.is_admin, false) as author_is_admin,
      c.body, c.created_at
    from public.match_dispute_chat_messages c
    join public.users u on u.id = c.author_id
    where c.match_id = $1
    order by c.created_at asc
    `,
    [matchId],
  );
}

export type AdminCancellationRequestRow = {
  id: string;
  requested_by: string;
  requester_email: string;
  requester_label: string | null;
  reason: string;
  status: string;
  created_at: string;
  attachment_paths: string[];
};

export async function listAdminCancellationRequests(
  matchId: string,
): Promise<AdminCancellationRequestRow[]> {
  return dbQuery<AdminCancellationRequestRow>(
    `
    select
      r.id,
      r.requested_by,
      u.email as requester_email,
      coalesce(u.display_name, u.roblox_username) as requester_label,
      r.reason,
      r.status,
      r.created_at,
      coalesce(r.attachment_paths, '{}') as attachment_paths
    from public.match_cancellation_requests r
    join public.users u on u.id = r.requested_by
    where r.match_id = $1
    order by r.created_at desc
    `,
    [matchId],
  );
}
