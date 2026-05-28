import { dbQuery, dbQueryOne } from "@/lib/db/query";
import { PVP_DISABLED_PLAYER_MESSAGE } from "@/lib/site/pvp-messages";

export { PVP_DISABLED_PLAYER_MESSAGE };

export async function getPvpEnabled(): Promise<boolean> {
  try {
    const row = await dbQueryOne<{ pvp_enabled: boolean }>(
      `select pvp_enabled from public.site_operational_state where id = 1`,
    );
    return row?.pvp_enabled ?? true;
  } catch {
    return true;
  }
}

export type PvpOperationalState = {
  pvpEnabled: boolean;
  updatedAt: string | null;
};

export async function getPvpOperationalState(): Promise<PvpOperationalState> {
  try {
    const row = await dbQueryOne<{ pvp_enabled: boolean; updated_at: string }>(
      `
      select pvp_enabled, updated_at
      from public.site_operational_state
      where id = 1
      `,
    );
    return {
      pvpEnabled: row?.pvp_enabled ?? true,
      updatedAt: row?.updated_at ?? null,
    };
  } catch {
    return { pvpEnabled: true, updatedAt: null };
  }
}

export async function setPvpEnabled(
  enabled: boolean,
  adminUserId: string,
): Promise<void> {
  await dbQuery(
    `
    update public.site_operational_state
    set
      pvp_enabled = $1,
      updated_at = now(),
      updated_by = $2::uuid
    where id = 1
    `,
    [enabled, adminUserId],
  );

  if (!enabled) {
    await dbQuery(`delete from public.match_queue`);
  }
}
