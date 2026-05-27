/** Libellé joueur pour l’admin : Roblox / pseudo site avant e-mail. */
export function formatAdminUserLabel(opts: {
  roblox_username?: string | null;
  display_name?: string | null;
  match_label?: string | null;
  email?: string | null;
  fallback?: string;
}): string {
  const roblox = opts.roblox_username?.trim();
  if (roblox) return roblox;
  const display = opts.display_name?.trim();
  if (display) return display;
  const label = opts.match_label?.trim();
  if (label) return label;
  const email = opts.email?.trim();
  if (email) return email;
  return opts.fallback ?? "Joueur";
}

export type AdminUserLabelFields = {
  roblox_username: string | null;
  display_name: string | null;
  email: string;
  match_label?: string | null;
};

export function labelFromAdminUser(
  u: AdminUserLabelFields,
  matchLabel?: string | null,
): string {
  return formatAdminUserLabel({
    roblox_username: u.roblox_username,
    display_name: u.display_name,
    match_label: matchLabel ?? u.match_label,
    email: u.email,
  });
}
