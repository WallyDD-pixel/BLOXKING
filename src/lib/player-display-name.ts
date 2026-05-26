/** Champs utilisateur pour afficher un pseudo dans l’UI. */
export type PlayerNameFields = {
  roblox_username: string | null;
  display_name: string | null;
  email?: string | null;
};

export function playerDisplayName(
  fields: PlayerNameFields,
  fallback = "Joueur",
): string {
  const roblox = fields.roblox_username?.trim();
  if (roblox) return roblox;
  const display = fields.display_name?.trim();
  if (display) return display;
  const email = fields.email?.trim();
  if (email) return email.split("@")[0] ?? fallback;
  return fallback;
}
