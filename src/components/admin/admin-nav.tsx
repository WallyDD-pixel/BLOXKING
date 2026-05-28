"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const baseLinks = [
  { href: "/admin", label: "Vue d’ensemble", exact: true },
  { href: "/admin/matchs", label: "Matchs" },
  { href: "/admin/litiges", label: "Litiges" },
] as const;

const usersLink = {
  href: "/admin/utilisateurs",
  label: "Utilisateurs",
} as const;

export function AdminNav({ canManageUsers }: { canManageUsers: boolean }) {
  const pathname = usePathname();
  const links = canManageUsers ? [...baseLinks, usersLink] : [...baseLinks];

  return (
    <nav className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
      {links.map(({ href, label, ...rest }) => {
        const exact = "exact" in rest && rest.exact;
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active
                ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            }`}
          >
            {label}
          </Link>
        );
      })}
      {!canManageUsers ? (
        <span className="self-center px-2 text-xs text-zinc-600">
          Accès modérateur litiges
        </span>
      ) : null}
    </nav>
  );
}
