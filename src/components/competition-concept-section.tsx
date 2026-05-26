import {
  COMPETITION_TAGLINE,
  FINAL_PRIZE_ROBUX,
  FINALIST_COUNT,
} from "@/lib/competition-copy";

const steps = [
  {
    tag: "Format",
    title: "1v1 uniquement",
    desc: "Pas de 2v2 ni d’équipes : chaque match est un duel solo en BO3 (premier à 2 manches). Défis ouverts ou file matchmaking.",
  },
  {
    tag: "Saison ranked",
    title: "Grimpe le classement",
    desc: "Chaque victoire validée fait monter ton ELO. Plus tu gagnes de duels sérieux, plus tu te rapproches du haut du tableau.",
  },
  {
    tag: `Top ${FINALIST_COUNT}`,
    title: "Les finalistes",
    desc: `À l’issue de la période de classement, les ${FINALIST_COUNT} meilleurs joueurs du site (classement ELO) sont qualifiés pour la finale.`,
  },
  {
    tag: "Finale",
    title: `${FINAL_PRIZE_ROBUX.toLocaleString("fr-FR")} Robux`,
    desc: `Les ${FINALIST_COUNT} finalistes s’affrontent lors d’un tournoi final organisé sur la plateforme. Le vainqueur remporte ${FINAL_PRIZE_ROBUX.toLocaleString("fr-FR")} Robux.`,
  },
];

export function CompetitionConceptSection() {
  return (
    <section
      className="relative mt-14 border-t border-white/[0.06] pt-12 sm:mt-16 sm:pt-14"
      aria-labelledby="competition-concept-heading"
    >
      <h2
        id="competition-concept-heading"
        className="font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-white sm:text-3xl md:text-4xl"
      >
        LE CONCEPT
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
        {COMPETITION_TAGLINE} Les combats ont lieu dans Roblox ; BloXKING enregistre
        les résultats, le classement et prépare la phase finale.
      </p>

      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="relative flex flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-5 shadow-lg shadow-black/25 transition hover:border-amber-500/20"
          >
            <span className="absolute right-4 top-4 font-[family-name:var(--font-bebas)] text-3xl leading-none text-amber-500/20">
              {i + 1}
            </span>
            <span className="w-fit rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-amber-400/95">
              {s.tag}
            </span>
            <h3 className="mt-3 text-base font-semibold leading-snug text-zinc-100">
              {s.title}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-500">
              {s.desc}
            </p>
          </li>
        ))}
      </ol>

      <p className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-relaxed text-zinc-500 sm:text-sm">
        <span className="font-medium text-amber-200/90">Rappel : </span>
        seul le PvP 1v1 compte pour le ladder. Enregistre tes combats en vidéo en
        cas de litige. Les règles exactes de la finale (dates, bracket) seront
        annoncées quand la phase qualificative se termine.
      </p>
    </section>
  );
}
