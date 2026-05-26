import type { ReactNode } from "react";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type PageShellProps = {
  children: ReactNode;
  /** Centrer verticalement le contenu (pages courtes) */
  center?: boolean;
};

export function PageShell({ children, center = false }: PageShellProps) {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-[#050506] text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 bg-glow-radial"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-grid-fade opacity-70"
        aria-hidden
      />
      <div className="relative flex min-h-full flex-1 flex-col">
        <SiteHeader />
        <div
          className={`relative flex flex-1 flex-col px-4 py-12 sm:px-6 ${center ? "items-center justify-center" : ""}`}
        >
          {children}
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
