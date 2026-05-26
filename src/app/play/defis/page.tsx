import Link from "next/link";
import {
  acceptChallengeForm,
  cancelChallengeForm,
  createChallengeForm,
} from "@/app/play/actions";
import { createClient } from "@/lib/supabase/server";

type Challenge = {
  id: string;
  creator_id: string;
  creator_display_name: string | null;
  status: string;
  created_at: string;
};

async function loadChallenges(): Promise<Challenge[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("open_challenges")
    .select("id, creator_id, creator_display_name, status, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as Challenge[];
}

export default async function DefisPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myId = user?.id;

  const challenges = await loadChallenges();

  let hasActiveMatch = false;
  if (myId) {
    const { count } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .or(`player_a.eq.${myId},player_b.eq.${myId}`)
      .in("status", ["pending", "disputed"]);
    hasActiveMatch = (count ?? 0) > 0;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.4em] text-amber-500/65">
          Arène · Liste
        </p>
        <h1 className="game-title mt-1 font-[family-name:var(--font-bebas)] text-4xl tracking-[0.12em] text-white sm:text-6xl">
          DÉFIS OUVERTS
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Chaque ligne est une demande de 1v1 classé. Publie ou accepte un duel.
        </p>
      </div>

      {hasActiveMatch ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-100/95">
          Tu as déjà une rencontre ranked en cours. Termine-la ou résous le
          litige avant de publier ou d&apos;accepter un nouveau défi.
        </div>
      ) : null}

      <form action={createChallengeForm}>
        <button
          type="submit"
          disabled={hasActiveMatch}
          className="game-btn-primary px-8 py-3 font-[family-name:var(--font-bebas)] text-xl tracking-wide text-zinc-950 disabled:pointer-events-none disabled:opacity-40"
        >
          <span>+ Publier un défi 1v1</span>
        </button>
      </form>

      <ul className="space-y-3">
        {challenges.length === 0 ? (
          <li className="rounded-xl border border-dashed border-zinc-600 bg-zinc-950/40 px-6 py-12 text-center">
            <p className="font-mono text-sm text-zinc-500">
              Aucun signal hostile. Sois le premier à lancer un défi.
            </p>
          </li>
        ) : (
          challenges.map((c) => {
            const isMine = c.creator_id === myId;
            return (
              <li key={c.id} className="game-panel rounded-xl px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-950/30 font-mono text-xs text-amber-300/85">
                      1v1
                    </span>
                    <div>
                      <p className="font-[family-name:var(--font-bebas)] text-xl tracking-wide text-white">
                        {c.creator_display_name ?? "Joueur"}
                      </p>
                      <p className="font-mono text-[0.65rem] text-zinc-500">
                        {new Date(c.created_at).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isMine ? (
                      <form action={cancelChallengeForm}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="game-btn-ghost px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-zinc-300"
                        >
                          <span>Retirer</span>
                        </button>
                      </form>
                    ) : (
                      <form action={acceptChallengeForm}>
                        <input type="hidden" name="challengeId" value={c.id} />
                        <button
                          type="submit"
                          disabled={hasActiveMatch}
                          className="game-btn-primary px-6 py-2.5 font-[family-name:var(--font-bebas)] text-lg tracking-wide text-zinc-950 disabled:pointer-events-none disabled:opacity-40"
                        >
                          <span>Engager</span>
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <p className="font-mono text-[0.65rem] text-zinc-600">
        Historique & ELO · bientôt. SQL requis si erreurs Supabase.
      </p>

      <Link
        href="/play"
        className="inline-flex font-mono text-xs uppercase tracking-wider text-amber-500/75 hover:text-amber-300"
      >
        ← Retour QG
      </Link>
    </div>
  );
}
