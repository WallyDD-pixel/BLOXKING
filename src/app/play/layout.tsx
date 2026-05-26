import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { MatchmakingSearchBadge } from "@/components/matchmaking-search-badge";
import { PlayHudFrame } from "@/components/play-hud-frame";
import { PlayNav } from "@/components/play-nav";
import { PageShell } from "@/components/page-shell";
import { createClient } from "@/lib/supabase/server";

export default async function PlayLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion?next=/play");
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-6xl flex-1">
        <PlayHudFrame>
          <PlayNav />
          <MatchmakingSearchBadge userId={user.id} />
          {children}
        </PlayHudFrame>
      </div>
    </PageShell>
  );
}
