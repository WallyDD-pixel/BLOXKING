import Link from "next/link";
import { SiteHeaderNav } from "@/components/site-header-nav";
import { userIsAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const isAdmin = user ? await userIsAdmin(user) : false;

  const display = user?.roblox_username ?? user?.display_name ?? user?.email?.split("@")[0] ?? null;

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#050506]/85 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-[#050506]/75">
      <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:min-h-16 sm:gap-4 sm:px-6 sm:py-0">
        <Link
          href="/"
          className="group flex min-h-11 shrink-0 items-center gap-1 font-[family-name:var(--font-bebas)] text-xl tracking-wide text-zinc-100 transition hover:text-amber-400 sm:text-2xl"
        >
          <span className="text-amber-400 transition group-hover:text-amber-300">
            BLOX
          </span>
          <span className="text-zinc-100">KING</span>
        </Link>
        <SiteHeaderNav
          isLoggedIn={Boolean(user)}
          isAdmin={isAdmin}
          display={display}
        />
      </div>
    </header>
  );
}
