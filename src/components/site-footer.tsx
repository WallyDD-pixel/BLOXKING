import { DiscordInviteLink } from "@/components/discord-invite-link";
import { YoutubeChannelLink } from "@/components/youtube-channel-link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#050506]/80 px-4 py-8 text-center sm:px-6">
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <DiscordInviteLink variant="button" className="w-full sm:w-auto" />
        <YoutubeChannelLink variant="button" className="w-full sm:w-auto" />
      </div>
      <p className="mt-5 text-xs leading-relaxed text-zinc-600">
        Ladder 1v1 · top 10 → finale · 10 000 Robux.
        <br />
        <span className="text-zinc-700">Projet communautaire non officiel.</span>
      </p>
    </footer>
  );
}
