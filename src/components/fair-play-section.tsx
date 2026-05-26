const points = [
  {
    title: "Double validation",
    text: "Les deux joueurs doivent confirmer le même résultat sur le site (victoire / défaite / nul / annulé). Tant que ce n’est pas aligné, le match ne compte pas pour le classement.",
  },
  {
    title: "Si tout le monde se dit gagnant",
    text: "Si les deux clament la victoire, le système ne peut pas trancher seul : le match reste non validé, sans ELO. Pas de points tant qu’il n’y a pas d’accord ou de décision après litige.",
  },
  {
    title: "Litiges & preuves",
    text: "En cas de désaccord, le match peut passer en litige. On pourra demander une courte preuve (capture / clip) ou une décision des modérateurs, selon les règles affichées sur la plateforme.",
  },
  {
    title: "Limite technique",
    text: "Le site ne lit pas les combats dans Roblox : on s’appuie sur l’honnêteté, la validation mutuelle et la modération. C’est transparent pour toute la communauté.",
  },
];

export function FairPlaySection() {
  return (
    <section
      className="relative mt-14 border-t border-white/[0.06] pt-12 sm:mt-16 sm:pt-14"
      aria-labelledby="fair-play-heading"
    >
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] via-transparent to-zinc-900/40 p-6 sm:p-8">
        <h2
          id="fair-play-heading"
          className="font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-amber-300/95 sm:text-3xl md:text-4xl"
        >
          FAIR PLAY & LITIGES
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300 sm:text-base">
          Le ranked doit rester crédible. Voici comment on gère les résultats et les
          cas où les joueurs ne sont pas d&apos;accord — avant même que tout soit
          automatisé dans l&apos;app, les principes sont les mêmes.
        </p>

        <ul className="mt-8 space-y-5">
          {points.map((p) => (
            <li
              key={p.title}
              className="border-l-2 border-amber-500/50 pl-4 sm:pl-5"
            >
              <h3 className="text-sm font-semibold text-zinc-100 sm:text-base">
                {p.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                {p.text}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-8 rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-xs leading-relaxed text-zinc-500 sm:text-sm">
          <span className="font-medium text-zinc-400">En résumé : </span>
          désaccord sur le gagnant → pas de points tant que le match n&apos;est pas
          résolu (accord, preuve acceptée ou décision modération). Les abus répétés
          pourront entraîner restrictions sur le compte, selon la charte du site.
        </p>
      </div>
    </section>
  );
}
