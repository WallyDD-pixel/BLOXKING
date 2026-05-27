import type { ReactNode } from "react";
import { AdSenseScript } from "@/components/ads/adsense-script";
import { AdSidebarRail } from "@/components/ads/ad-sidebar-rail";
import { AdTopBanner } from "@/components/ads/ad-top-banner";
import { YoutubeSubscribePopup } from "@/components/youtube-subscribe-popup";
import { SessionSyncSlot } from "@/components/session-sync-slot";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type PageShellProps = {
  children: ReactNode;
  /** Centrer verticalement le contenu (pages courtes) */
  center?: boolean;
  /** Colonnes latérales + bannière pub (desktop). Désactiver sur connexion / inscription. */
  ads?: boolean;
};

export function PageShell({
  children,
  center = false,
  ads = true,
}: PageShellProps) {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-[#050506] text-zinc-100">
      <AdSenseScript />
      <div
        className="pointer-events-none absolute inset-0 bg-glow-radial"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-grid-fade opacity-70"
        aria-hidden
      />
      <div className="relative flex min-h-full flex-1 flex-col">
        <SessionSyncSlot />
        <YoutubeSubscribePopup />
        <SiteHeader />
        <div
          className={`relative flex flex-1 flex-col px-4 py-12 sm:px-6 ${center ? "items-center justify-center" : ""}`}
        >
          {ads ? (
            <div className="mx-auto flex w-full max-w-[1400px] items-start gap-6 xl:gap-8">
              <AdSidebarRail side="left" />
              <div className="min-w-0 flex-1">
                <AdTopBanner />
                {children}
              </div>
              <AdSidebarRail side="right" />
            </div>
          ) : (
            children
          )}
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
