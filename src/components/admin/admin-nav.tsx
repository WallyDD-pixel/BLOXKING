"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Vue d’ensemble", exact: true },
  { href: "/admin/matchs", label: "Matchs" },
  { href: "/admin/litiges", label: "Litiges" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
      {links.map(({ href, label, exact }) => {
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
    </nav>
  );
}
