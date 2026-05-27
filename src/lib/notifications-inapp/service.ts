import { dbQuery, dbQueryOne } from "@/lib/db/query";

export type InAppNotificationKind =
  | "match_result"
  | "dispute_opened"
  | "dispute_message"
  | "match_cancelled"
  | "admin_update"
  | "system";

export type InAppNotificationRow = {
  id: string;
  kind: InAppNotificationKind;
  title: string;
  body: string;
  href: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

type CreateInAppNotificationInput = {
  userId: string;
  kind: InAppNotificationKind;
  title: string;
  body: string;
  href?: string | null;
  payload?: Record<string, unknown>;
};

export async function createInAppNotification(input: CreateInAppNotificationInput) {
  await dbQueryOne(
    `
    insert into public.user_notifications
      (user_id, kind, title, body, href, payload)
    values
      ($1, $2, $3, $4, $5, $6::jsonb)
    returning id
    `,
    [
      input.userId,
      input.kind,
      input.title,
      input.body,
      input.href ?? null,
      JSON.stringify(input.payload ?? {}),
    ],
  );
}

export async function createInAppNotificationsBulk(inputs: CreateInAppNotificationInput[]) {
  if (inputs.length === 0) return;
  await Promise.all(inputs.map((i) => createInAppNotification(i)));
}

export async function listUserNotifications(
  userId: string,
  limit = 30,
): Promise<InAppNotificationRow[]> {
  const lim = Math.min(Math.max(limit, 1), 100);
  return dbQuery<InAppNotificationRow>(
    `
    select
      id,
      kind,
      title,
      body,
      href,
      payload,
      read_at,
      created_at
    from public.user_notifications
    where user_id = $1
    order by created_at desc
    limit $2
    `,
    [userId, lim],
  );
}

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const row = await dbQueryOne<{ c: string }>(
    `
    select count(*)::text as c
    from public.user_notifications
    where user_id = $1
      and read_at is null
    `,
    [userId],
  );
  return Number(row?.c ?? 0);
}

export async function markNotificationsRead(userId: string, ids: string[]) {
  if (ids.length === 0) return;
  await dbQuery(
    `
    update public.user_notifications
    set read_at = now()
    where user_id = $1
      and id = any($2::uuid[])
      and read_at is null
    `,
    [userId, ids],
  );
}

export async function markAllNotificationsRead(userId: string) {
  await dbQuery(
    `
    update public.user_notifications
    set read_at = now()
    where user_id = $1
      and read_at is null
    `,
    [userId],
  );
}
