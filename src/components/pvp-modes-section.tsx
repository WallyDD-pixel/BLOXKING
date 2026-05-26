const modes = [
  {
    tag: "Principal",
    title: "1v1 — Duel classé",
    desc: "Tu défies un joueur en solo : le résultat compte pour le classement (ELO ou ligues). Les deux valident le score pour éviter les abus.",
  },
  {
    tag: "À venir",
    title: "2v2 — Équipes",
    desc: "Deux contre deux, avec la même idée de validation mutuelle. Idéal pour jouer avec un mate et monter ensemble.",
  },
  {
    tag: "Organisation",
    title: "Format & manches",
    desc: "Best-of, timer, règles du lobby : tout sera posé avant le match pour que ce soit joué pareil pour tout le monde.",
  },
  {
    tag: "Hors ladder",
    title: "Match amical",
    desc: "Affrontement sans impact sur le ranked — pour tester des styles ou s’entraîner sans pression.",
  },
];

export function PvpModesSection() {
  return (
    <section
      className="relative mt-14 border-t border-white/[0.06] pt-12 sm:mt-16 sm:pt-14"
      aria-labelledby="pvp-modes-heading"
    >
      <h2
        id="pvp-modes-heading"
        className="font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-white sm:text-3xl md:text-4xl"
      >
        MODES PVP PROPOSÉS
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
        Le PvP sur BloXKING repose sur des formats lisibles : d’abord le{" "}
        <span className="text-zinc-200">1v1 classé</span>, puis d’autres modes
        au fil des mises à jour. Tout se joue dans le jeu ; ici on trace les
        résultats et le classement.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {modes.map((m) => (
          <li
            key={m.title}
            className="flex flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-5 shadow-lg shadow-black/25 transition hover:border-amber-500/20 hover:shadow-amber-950/10"
          >
            <span className="w-fit rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-amber-400/95">
              {m.tag}
            </span>
            <h3 className="mt-3 text-base font-semibold leading-snug text-zinc-100">
              {m.title}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-500">
              {m.desc}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
