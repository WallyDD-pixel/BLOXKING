import Link from "next/link";

export function BackLink({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition hover:text-amber-400"
    >
      <span
        className="inline-block transition group-hover:-translate-x-0.5"
        aria-hidden
      >
        ←
      </span>
      Accueil
    </Link>
  );
}
