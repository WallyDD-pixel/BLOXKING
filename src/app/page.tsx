import Link from "next/link";
import { HomeImageStrip } from "@/components/home-image-strip";
import { PageShell } from "@/components/page-shell";
import { FairPlaySection } from "@/components/fair-play-section";
import { PvpModesSection } from "@/components/pvp-modes-section";

function IconChart() {
  return (
    <svg
      className="h-7 w-7 text-amber-400/90"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
      />
    </svg>
  );
}

function IconShield() {
  return (
    <svg
      className="h-7 w-7 text-amber-400/90"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

function IconUser() {
  return (
    <svg
      className="h-7 w-7 text-amber-400/90"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  );
}

const features = [
  {
    title: "Classement vivant",
    desc: "ELO ou ligues selon les matchs validés — tu vois où tu te situes en temps réel.",
    Icon: IconChart,
  },
  {
    title: "Matchs sérieux",
    desc: "Chaque résultat peut être confirmé par les deux joueurs pour garder un ladder crédible.",
    Icon: IconShield,
  },
  {
    title: "Profil joueur",
    desc: "Pseudo Roblox, historique et progression — tout au même endroit.",
    Icon: IconUser,
  },
];

export default function Home() {
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-6xl flex-1">
        <section className="relative pb-16 pt-6 sm:pb-24 sm:pt-10">
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl sm:-left-10" />
          <div className="absolute -right-16 top-40 h-64 w-64 rounded-full bg-teal-500/8 blur-3xl" />

          <p className="relative mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/95">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            Communauté PvP
          </p>

          <h1 className="relative max-w-3xl font-[family-name:var(--font-bebas)] text-5xl leading-[0.95] tracking-wide text-white sm:text-6xl md:text-7xl">
            <span className="block bg-gradient-to-br from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              LE RANKED
            </span>
            <span className="mt-1 block bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600 bg-clip-text text-transparent">
              QU&apos;IL MANQUE AU JEU
            </span>
          </h1>

          <HomeImageStrip />

          <p className="relative mt-8 max-w-xl text-lg leading-relaxed text-zinc-400">
            Inscris-toi, affronte d&apos;autres joueurs et grimpe dans le classement.
            Les matchs seront validés par les deux joueurs pour limiter la triche.
          </p>
          <p className="relative mt-3 max-w-xl text-sm text-zinc-600">
            Projet fan — non affilié à Roblox ni aux créateurs de Blox Fruits.
          </p>

          <div className="relative mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/inscription"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 px-8 text-sm font-bold text-zinc-950 shadow-xl shadow-amber-900/40 ring-1 ring-amber-400/50 transition hover:from-amber-300 hover:to-amber-500 hover:shadow-amber-800/50"
            >
              Créer un compte
            </Link>
            <Link
              href="/classement"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-8 text-sm font-semibold text-zinc-100 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/[0.08]"
            >
              Voir le classement
            </Link>
          </div>

          <PvpModesSection />

          <FairPlaySection />
        </section>

        <section className="relative border-t border-white/[0.06] pt-12 sm:pt-16">
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-zinc-300 sm:text-3xl">
            POURQUOI BLOXKING
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Un hub simple pour la compétition, sans remplacer le jeu — juste un vrai ladder
            pour la scène PvP.
          </p>

          <ul className="mt-10 grid gap-4 sm:grid-cols-3">
            {features.map(({ title, desc, Icon }) => (
              <li
                key={title}
                className="group rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.06] to-transparent p-6 shadow-lg shadow-black/20 transition hover:border-amber-500/25 hover:shadow-amber-950/20"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20 transition group-hover:bg-amber-500/15">
                  <Icon />
                </div>
                <h3 className="mt-4 text-base font-semibold text-zinc-100">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                  {desc}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
