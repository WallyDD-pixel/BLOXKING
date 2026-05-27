import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import { FINAL_PRIZE_ROBUX, FINALIST_COUNT } from "@/lib/competition-copy";
import { DiscordInviteLink } from "@/components/discord-invite-link";
import { YoutubeChannelLink } from "@/components/youtube-channel-link";

export function HomeHeroCta({ user }: { user: SessionUser | null }) {
  const display =
    user?.roblox_username ?? user?.display_name ?? user?.email?.split("@")[0];

  return (
    <div className="relative mt-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 px-5 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:mt-10 sm:px-8 sm:py-9">
      <div className="pointer-events-none absolute -right-20 top-0 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />

      {user ? (
        <p className="relative text-center font-mono text-[0.65rem] uppercase tracking-[0.28em] text-amber-400/90">
          Connecté · {display}
        </p>
      ) : (
        <p className="relative text-center font-mono text-[0.65rem] uppercase tracking-[0.28em] text-amber-400/90">
          Tournoi PvP 1v1 · {FINAL_PRIZE_ROBUX.toLocaleString("fr-FR")} Robux
        </p>
      )}

      <p className="relative mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed text-zinc-300 sm:text-lg">
        Duels <strong className="font-medium text-white">1v1</strong> classés — le{" "}
        <strong className="font-medium text-amber-200">
          top {FINALIST_COUNT}
        </strong>{" "}
        joue la finale pour{" "}
        <strong className="font-medium text-amber-200">
          {FINAL_PRIZE_ROBUX.toLocaleString("fr-FR")} Robux
        </strong>
        .
      </p>

      <div className="relative mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
        {user ? (
          <Link
            href="/play"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 px-8 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-900/35 ring-1 ring-amber-400/50 transition hover:from-amber-300 hover:to-amber-500"
          >
            Jouer maintenant
          </Link>
        ) : (
          <>
            <Link
              href="/inscription"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 px-8 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-900/35 ring-1 ring-amber-400/50 transition hover:from-amber-300 hover:to-amber-500"
            >
              Créer un compte
            </Link>
            <Link
              href="/connexion"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-8 text-sm font-semibold text-zinc-100 transition hover:border-white/25 hover:bg-white/[0.08]"
            >
              Connexion
            </Link>
          </>
        )}
        <Link
          href="/classement"
          className="inline-flex h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-8 text-sm font-semibold text-zinc-100 transition hover:border-white/25 hover:bg-white/[0.08]"
        >
          Voir le classement
        </Link>
        <DiscordInviteLink />
        <YoutubeChannelLink />
      </div>

      <p className="relative mt-5 text-center text-xs leading-relaxed text-zinc-600">
        Projet fan — non affilié à Roblox ni aux créateurs de Blox Fruits.
      </p>
    </div>
  );
}
