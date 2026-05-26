import { dbQuery, dbQueryOne } from "@/lib/db/query";

export async function enrichMatchLabels(matchId: string): Promise<void> {
  const m = await dbQueryOne<{
    id: string;
    player_a: string;
    player_b: string;
  }>(
    `select id, player_a, player_b from public.matches where id = $1`,
    [matchId],
  );
  if (!m) return;

  const users = await dbQuery<{
    id: string;
    roblox_username: string | null;
    display_name: string | null;
    email: string;
  }>(
    `
    select id, roblox_username, display_name, email
    from public.users
    where id = any($1::uuid[])
    `,
    [[m.player_a, m.player_b]],
  );

  const byId = new Map(users.map((u) => [u.id, u]));
  const label = (id: string) => {
    const u = byId.get(id);
    if (!u) return "Joueur";
    return u.roblox_username ?? u.display_name ?? u.email.split("@")[0] ?? "Joueur";
  };
  const roblox = (id: string) => {
    const u = byId.get(id);
    const v = u?.roblox_username?.trim();
    return v && v.length > 0 ? v : null;
  };

  await dbQueryOne(
    `
    update public.matches
    set
      player_a_label = $2,
      player_b_label = $3,
      player_a_roblox = $4,
      player_b_roblox = $5
    where id = $1
    `,
    [matchId, label(m.player_a), label(m.player_b), roblox(m.player_a), roblox(m.player_b)],
  );
}
