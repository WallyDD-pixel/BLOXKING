"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  {
    href: "/play",
    label: "QG",
    sub: "Tableau de bord",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75A2.25 2.25 0 0115.75 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H15.75A2.25 2.25 0 0113.5 18v-2.25zM13.5 6A2.25 2.25 0 0115.75 3.75h2.25A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: "/play/defis",
    label: "Arène",
    sub: "Défis ouverts",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425-2.121a6 6 0 010 8.485m8.485 0a6 6 0 010-8.485M12 12h.008v.008H12V12z" />
      </svg>
    ),
  },
  {
    href: "/play/recherche",
    label: "Matchmaking",
    sub: "Recherche",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6" />
      </svg>
    ),
  },
  {
    href: "/play/mes-rencontres",
    label: "Rencontres",
    sub: "Historique",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export function PlayNav() {
  const pathname = usePathname();

  return (
    <nav
      className="mb-8 grid grid-cols-2 gap-2 lg:grid-cols-4"
      aria-label="Menu espace joueur"
    >
      {links.map(({ href, label, sub, icon }) => {
        const active =
          href === "/play/recherche"
            ? pathname.startsWith("/play/recherche") ||
              pathname.startsWith("/play/match/")
            : href === "/play/mes-rencontres"
              ? pathname.startsWith("/play/mes-rencontres")
              : pathname === href ||
                (href !== "/play" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`group relative flex items-center gap-3 overflow-hidden rounded-lg border px-4 py-3 transition ${
              active
                ? "border-amber-400/45 bg-amber-950/35 shadow-[0_0_24px_rgba(245,158,11,0.12)]"
                : "border-white/10 bg-black/30 hover:border-amber-500/25 hover:bg-amber-950/15"
            } `}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border ${
                active
                  ? "border-amber-400/50 bg-amber-500/15 text-amber-300"
                  : "border-white/10 bg-zinc-900/80 text-zinc-500 group-hover:text-amber-400/85"
              }`}
            >
              {icon}
            </span>
            <span className="min-w-0 text-left">
              <span className="block font-[family-name:var(--font-bebas)] text-lg tracking-wide text-white">
                {label}
              </span>
              <span className="block truncate text-[0.65rem] font-mono uppercase tracking-wider text-zinc-500">
                {sub}
              </span>
            </span>
            {active ? (
              <span className="absolute bottom-0 left-0 h-0.5 w-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
