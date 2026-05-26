export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#050506]/80 px-4 py-8 text-center sm:px-6">
      <p className="text-xs leading-relaxed text-zinc-600">
        Ladder 1v1 · top 10 → finale · 10 000 Robux.{" "}
        <a
          href="https://www.youtube.com/@warrenoff"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-500 underline-offset-2 hover:text-red-400/90 hover:underline"
        >
          Chaîne YouTube
        </a>
        .
        <br />
        <span className="text-zinc-700">Projet communautaire non officiel.</span>
      </p>
    </footer>
  );
}
