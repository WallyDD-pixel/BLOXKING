import type { ReactNode } from "react";

type PlayHudFrameProps = {
  children: ReactNode;
};

export function PlayHudFrame({ children }: PlayHudFrameProps) {
  return (
    <div className="game-play-root relative min-h-[50vh]">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl opacity-[0.35]"
        aria-hidden
      >
        <div className="game-scanlines absolute inset-0" />
        <div className="game-vignette absolute inset-0 rounded-2xl" />
      </div>

      <div className="relative z-[1]">
        <header className="game-top-bar mb-8 flex flex-col gap-3 border-b border-amber-500/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
            </span>
            <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-amber-400/90">
              Système en ligne
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[0.6rem] uppercase tracking-[0.25em] text-zinc-600">
            <span className="hidden sm:inline text-amber-600/70">Ranked 1v1</span>
            <span className="rounded border border-white/10 bg-black/50 px-2 py-1 text-zinc-500">
              build 0.1
            </span>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
