import Image from "next/image";
import fs from "fs";
import path from "path";
import { TOURNAMENT_HERO_ALT, TOURNAMENT_HERO_IMAGE } from "@/lib/site-images";

function heroFileExists(): boolean {
  try {
    return fs.existsSync(
      path.join(process.cwd(), "public", "images", "tournoi-pvp-hero.png"),
    );
  } catch {
    return false;
  }
}

export function TournamentHeroBanner({
  variant = "home",
}: {
  variant?: "home" | "compact";
}) {
  const exists = heroFileExists();
  const isHome = variant === "home";

  if (!exists) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border border-dashed border-amber-500/35 bg-gradient-to-br from-amber-950/40 via-zinc-950 to-zinc-950 ${
          isHome ? "px-6 py-16 text-center sm:py-20" : "px-4 py-10 text-center"
        }`}
      >
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-amber-400/90">
          Visuel tournoi
        </p>
        <p className="mt-3 text-sm text-zinc-400">
          Place ta bannière dans{" "}
          <code className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-xs text-amber-300/90">
            public/images/tournoi-pvp-hero.png
          </code>
        </p>
      </div>
    );
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-amber-500/25 bg-zinc-950 shadow-[0_0_60px_rgba(245,158,11,0.12)] ${
        isHome ? "ring-1 ring-amber-500/20" : "ring-1 ring-white/10"
      }`}
    >
      <div
        className={
          isHome
            ? "relative aspect-[16/9] w-full max-h-[min(55vh,520px)] sm:max-h-[min(62vh,560px)]"
            : "relative aspect-[21/9] w-full max-h-48 sm:max-h-56"
        }
      >
        <Image
          src={TOURNAMENT_HERO_IMAGE}
          alt={TOURNAMENT_HERO_ALT}
          fill
          priority={isHome}
          className="object-cover object-[50%_35%] transition duration-500 group-hover:scale-[1.02]"
          sizes={
            isHome
              ? "(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1152px"
              : "(max-width: 768px) 100vw, 768px"
          }
        />
        {isHome ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#050506] via-[#050506]/60 to-transparent sm:h-28" />
        ) : null}
      </div>
    </div>
  );
}
