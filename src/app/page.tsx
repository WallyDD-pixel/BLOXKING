import { Suspense } from "react";
import { CompetitionConceptSection } from "@/components/competition-concept-section";
import { FairPlaySection } from "@/components/fair-play-section";
import { HomeHeroCta } from "@/components/home-hero-cta";
import { HomeImageStrip } from "@/components/home-image-strip";
import { PageShell } from "@/components/page-shell";
import { TournamentHeroBanner } from "@/components/tournament-hero-banner";
import { YoutubeHomeMedia } from "@/components/youtube-home-media";
import { YoutubeLiveBanner } from "@/components/youtube-live-banner";
import { getCurrentUser } from "@/lib/auth/session";
import { FINAL_PRIZE_ROBUX, FINALIST_COUNT } from "@/lib/competition-copy";

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
    title: "Duels 1v1 classés",
    desc: "BO3 en solo : défis ou matchmaking. Chaque match validé fait évoluer ton ELO sur le site.",
    Icon: IconUser,
  },
  {
    title: `Top ${FINALIST_COUNT} finalistes`,
    desc: `Les ${FINALIST_COUNT} premiers du classement à la fin de la phase ranked sont qualifiés pour la finale.`,
    Icon: IconChart,
  },
  {
    title: `${FINAL_PRIZE_ROBUX.toLocaleString("fr-FR")} Robux`,
    desc: `Le vainqueur du tournoi final entre les ${FINALIST_COUNT} finalistes remporte ${FINAL_PRIZE_ROBUX.toLocaleString("fr-FR")} Robux.`,
    Icon: IconShield,
  },
];

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-6xl flex-1">
        <section className="relative pb-16 pt-2 sm:pb-24 sm:pt-4">
          <h1 className="sr-only">
            BloXKING — tournoi PvP Blox Fruit 1v1, top {FINALIST_COUNT} finale,{" "}
            {FINAL_PRIZE_ROBUX.toLocaleString("fr-FR")} Robux
          </h1>

          <Suspense fallback={null}>
            <YoutubeLiveBanner />
          </Suspense>

          <TournamentHeroBanner variant="home" />

          <HomeHeroCta user={user} />

          <Suspense fallback={null}>
            <YoutubeHomeMedia />
          </Suspense>

          <div className="mt-12">
            <HomeImageStrip />
          </div>

          <CompetitionConceptSection />

          <FairPlaySection />
        </section>

        <section className="relative border-t border-white/[0.06] pt-12 sm:pt-16">
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-zinc-300 sm:text-3xl">
            POURQUOI BLOXKING
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Un ladder 1v1 transparent : du matchmaking au ticket finale, tout est pensé
            pour qualifier les {FINALIST_COUNT} meilleurs pilotes.
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
