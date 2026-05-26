import { MatchmakingClient } from "@/app/play/recherche/matchmaking-client";
import { RechercheHashScroll } from "@/app/play/recherche/hash-scroll";
import { listOngoingMatches } from "@/app/play/actions";
import { createClient } from "@/lib/supabase/server";

export default async function RecherchePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const displayName =
    (user.user_metadata as { roblox_username?: string } | undefined)
      ?.roblox_username ??
    user.email?.split("@")[0] ??
    "Joueur";

  const { rows: ongoingMatches } = await listOngoingMatches();

  const { data: rankedRow } = await supabase
    .from("player_ranked_stats")
    .select("placement_matches_played")
    .eq("user_id", user.id)
    .maybeSingle();
  const placementMatchesPlayed = rankedRow?.placement_matches_played ?? 0;

  return (
    <div className="space-y-8">
      <RechercheHashScroll />

      <div>
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.4em] text-amber-500/65">
          Matchmaking
        </p>
        <h1 className="game-title mt-1 font-[family-name:var(--font-bebas)] text-4xl tracking-[0.12em] text-white sm:text-6xl">
          RECHERCHE
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
          File d&apos;attente : le moteur te jumelle avec le prochain pilote
          disponible.
        </p>
      </div>

      <div className="game-panel rounded-2xl p-6 sm:p-10">
        <MatchmakingClient
          userId={user.id}
          displayName={displayName}
          initialOngoingMatches={ongoingMatches}
          placementMatchesPlayed={placementMatchesPlayed}
        />
      </div>
    </div>
  );
}
