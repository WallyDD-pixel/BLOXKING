import { MatchmakingClient } from "@/app/play/recherche/matchmaking-client";
import { RechercheHashScroll } from "@/app/play/recherche/hash-scroll";
import { listOngoingMatches } from "@/app/play/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { dbQueryOne } from "@/lib/db/query";

export default async function RecherchePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const displayName =
    user.roblox_username ?? user.display_name ?? user.email.split("@")[0] ?? "Joueur";

  const { rows: ongoingMatches } = await listOngoingMatches();

  const rankedRow = await dbQueryOne<{ placement_matches_played: number }>(
    `select placement_matches_played from public.player_ranked_stats where user_id = $1`,
    [user.id],
  );
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
          File 1v1 : le moteur te jumelle avec le prochain adversaire disponible.
          Chaque victoire fait monter ton ELO vers le top 10 qualificatif. Enregistre
          le combat avant le premier round.
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
