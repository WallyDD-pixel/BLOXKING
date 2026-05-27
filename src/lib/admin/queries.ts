import { dbQuery, dbQueryOne } from "@/lib/db/query";

export type AdminStats = {
  users_total: number;
  matches_total: number;
  matches_active: number;
  matches_disputed: number;
  matches_confirmed: number;
  open_challenges: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  const row = await dbQueryOne<AdminStats>(
    `
    select
      (select count(*)::int from public.users) as users_total,
      (select count(*)::int from public.matches) as matches_total,
      (select count(*)::int from public.matches
        where status in ('pending', 'disputed')) as matches_active,
      (select count(*)::int from public.matches
        where status = 'disputed' or dispute = true) as matches_disputed,
      (select count(*)::int from public.matches
        where status = 'confirmed') as matches_confirmed,
      (select count(*)::int from public.open_challenges
        where status = 'open') as open_challenges
    `,
  );
  return (
    row ?? {
      users_total: 0,
      matches_total: 0,
      matches_active: 0,
      matches_disputed: 0,
      matches_confirmed: 0,
      open_challenges: 0,
    }
  );
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
  ticket_count: number;
  first_ticket_at: string | null;
  chat_count: number;
};

export async function listAdminDisputes(): Promise<AdminDisputeRow[]> {
  return dbQuery<AdminDisputeRow>(
    `
    select
      m.id as match_id,
      m.status,
      m.created_at,
      ua.email as player_a_email,
      ub.email as player_b_email,
      coalesce(t.cnt, 0)::int as ticket_count,
      t.first_at as first_ticket_at,
      coalesce(c.cnt, 0)::int as chat_count
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
    where m.status = 'disputed' or m.dispute = true
    order by coalesce(t.first_at, m.created_at) desc
  `,
  );
}

export type AdminUserRow = {
  id: string;
  email: string;
  display_name: string | null;
  roblox_username: string | null;
  created_at: string;
  is_admin: boolean;
  elo: number | null;
  placement_matches_played: number | null;
  matches_total: number;
  matches_wins: number;
};

export async function listAdminUsers(limit = 100): Promise<AdminUserRow[]> {
  const lim = Math.min(Math.max(limit, 1), 300);
  return dbQuery<AdminUserRow>(
    `
    select
      u.id,
      u.email,
      u.display_name,
      u.roblox_username,
      u.created_at,
      coalesce(u.is_admin, false) as is_admin,
      s.elo,
      s.placement_matches_played,
      coalesce(m.total, 0)::int as matches_total,
      coalesce(m.wins, 0)::int as matches_wins
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
    order by u.created_at desc
    limit $1
    `,
    [lim],
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
  body: string;
  created_at: string;
  attachment_paths: string[];
};

export async function listAdminTickets(matchId: string): Promise<AdminTicketRow[]> {
  const rows = await dbQuery<{
    id: string;
    opened_by: string;
    opener_email: string;
    body: string;
    created_at: string;
    attachment_paths: string[] | null;
  }>(
    `
    select
      t.id, t.opened_by, u.email as opener_email,
      t.body, t.created_at, t.attachment_paths
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
      r.created_at
    from public.match_cancellation_requests r
    join public.users u on u.id = r.requested_by
    where r.match_id = $1
    order by r.created_at desc
    `,
    [matchId],
  );
}
