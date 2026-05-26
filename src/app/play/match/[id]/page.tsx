import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MatchBackToList } from "@/components/match-back-to-list";
import { getCurrentUser } from "@/lib/auth/session";
import { dbQueryOne } from "@/lib/db/query";
import { rpcJsonSystem } from "@/lib/db/rpc";
import { enrichMatchLabels } from "@/lib/match/enrich-labels";
import { getRankedSnapshotsForMatchParticipants } from "@/app/play/actions";
import { MatchArenaClient, type MatchArenaRow } from "./match-arena-client";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/play");

  try {
    await enrichMatchLabels(id);
  } catch {
    /* labels optionnels */
  }

  await rpcJsonSystem(
    `select expire_disputed_matches_after_ticket_timeout() as result`,
  );

  const match = await dbQueryOne<MatchArenaRow>(
    `select * from public.matches where id = $1`,
    [id],
  );

  if (!match) notFound();
  const m = match;
  if (m.player_a !== user.id && m.player_b !== user.id) notFound();

  const { rankedA, rankedB } = await getRankedSnapshotsForMatchParticipants(
    m.player_a,
    m.player_b,
  );

  const sourceLabel = m.source === "queue" ? "Matchmaking" : "Défi ouvert";

  return (
    <div className="space-y-8 sm:space-y-10">
      <MatchBackToList />

      <header className="relative border-b border-amber-500/15 pb-8 pl-1 sm:pb-10 sm:pl-2">
        <div className="pointer-events-none absolute left-0 top-0 h-9 w-1 rounded-full bg-gradient-to-b from-amber-400/90 to-amber-800/30 sm:h-11" />
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.4em] text-amber-500/75">
            Rencontre
          </p>
          <span className="rounded border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 font-mono text-[0.55rem] font-semibold uppercase tracking-wider text-amber-200/95">
            BO3
          </span>
        </div>
        <h1 className="game-title mt-3 font-[family-name:var(--font-bebas)] text-4xl tracking-[0.14em] text-white sm:mt-4 sm:text-5xl md:text-6xl">
          MATCH 1V1
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:mt-5 sm:text-[0.95rem]">
          <span className="text-zinc-500">Étapes :</span> confirmer le début en
          jeu, déclarer le même résultat, puis valider chacun la déclaration de
          l&apos;adversaire avant de clôturer.
        </p>
      </header>

      <MatchArenaClient
        matchId={id}
        userId={user.id}
        initialMatch={m}
        initialRankedA={rankedA}
        initialRankedB={rankedB}
        sourceLabel={sourceLabel}
      />

      <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-6">
        <Link
          href="/play/recherche#rencontres-en-cours"
          className="font-mono text-xs uppercase tracking-wider text-amber-500/85 hover:text-amber-400"
        >
          ← Recherche (rencontres en cours)
        </Link>
        <span className="text-zinc-700">|</span>
        <Link
          href="/play/recherche"
          className="font-mono text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
        >
          Recherche
        </Link>
        <span className="text-zinc-700">|</span>
        <Link
          href="/play"
          className="font-mono text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
        >
          QG
        </Link>
      </div>
    </div>
  );
}
