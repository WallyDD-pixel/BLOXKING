import { YOUTUBE_CHANNEL_LABEL, YOUTUBE_CHANNEL_URL } from "@/lib/site-links";

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function YoutubeChannelLink({
  variant = "button",
  className = "",
}: {
  variant?: "button" | "header";
  className?: string;
}) {
  const base =
    variant === "header"
      ? "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300"
      : "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-950/30 px-6 text-sm font-semibold text-red-100 transition hover:border-red-400/50 hover:bg-red-500/20";

  return (
    <a
      href={YOUTUBE_CHANNEL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${className}`}
      aria-label={YOUTUBE_CHANNEL_LABEL}
    >
      <YoutubeIcon
        className={
          variant === "header" ? "size-4" : "size-5"
        }
      />
      <span>{variant === "header" ? "YouTube" : "Chaîne YouTube"}</span>
    </a>
  );
}
