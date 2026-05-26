import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const navItems = [
    ...(user ? [{ href: "/play", label: "Jouer" as const }] : []),
    { href: "/classement", label: "Classement" },
    ...(!user ? [{ href: "/connexion", label: "Connexion" as const }] : []),
  ];

  const display =
    (user?.user_metadata?.roblox_username as string | undefined) ??
    user?.email?.split("@")[0] ??
    null;

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#050506]/75 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-baseline gap-1 font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-zinc-100 transition hover:text-amber-400"
        >
          <span className="text-amber-400 transition group-hover:text-amber-300">
            BLOX
          </span>
          <span className="text-zinc-100">KING</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
            >
              {item.label}
            </Link>
          ))}
          {user ? (
            <>
              <span
                className="hidden max-w-[140px] truncate px-2 text-sm text-zinc-300 sm:inline"
                title={display ?? undefined}
              >
                {display}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
                >
                  Déconnexion
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/inscription"
                className="ml-1 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-900/30 transition hover:from-amber-300 hover:to-amber-500"
              >
                S&apos;inscrire
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
