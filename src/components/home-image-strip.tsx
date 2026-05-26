import Image from "next/image";
import { getSrcImgFilenames } from "@/lib/src-img-files";

export function HomeImageStrip() {
  const files = getSrcImgFilenames();

  if (files.length === 0) {
    return (
      <div className="relative mt-8 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center sm:px-6">
        <p className="text-sm text-zinc-500">
          Ajoute des images dans{" "}
          <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-amber-500/90">
            src/img
          </code>{" "}
          (PNG, JPG, WebP, GIF, SVG) — elles apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <div className="relative mt-10">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px min-w-[2rem] flex-1 bg-gradient-to-r from-transparent via-amber-500/35 to-amber-500/15" />
        <span className="shrink-0 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-amber-400/85">
          Visuels
        </span>
        <span className="h-px min-w-[2rem] flex-1 bg-gradient-to-l from-transparent via-amber-500/35 to-amber-500/15" />
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin] [scrollbar-color:rgba(245,158,11,0.35)_transparent] sm:mx-0 sm:snap-none sm:flex-wrap sm:justify-center sm:gap-4 sm:overflow-visible">
        {files.map((file) => (
          <div key={file} className="group relative shrink-0 snap-center">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-transparent to-teal-600/10 opacity-70 blur-sm transition group-hover:opacity-100" />
            <div className="relative flex h-[5rem] w-[5rem] items-center justify-center rounded-2xl border border-white/[0.1] bg-zinc-900/90 p-2.5 shadow-inner shadow-black/50 ring-1 ring-white/[0.05] sm:h-[7.25rem] sm:w-[7.25rem] sm:p-3">
              <Image
                src={`/api/img/${encodeURIComponent(file)}`}
                alt=""
                width={116}
                height={116}
                className="h-full w-full object-contain drop-shadow-[0_4px_20px_rgba(245,158,11,0.25)] transition duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 5rem, 7.25rem"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
