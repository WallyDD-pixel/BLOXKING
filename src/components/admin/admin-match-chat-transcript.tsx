import type { ReactNode } from "react";
import type { AdminChatRow } from "@/lib/admin/queries";
import { formatAdminUserLabel } from "@/lib/admin/user-label";
import { formatDateTimeFr } from "@/lib/format-datetime";

type MatchPlayers = {
  player_a: string;
  player_b: string;
  player_a_label: string | null;
  player_b_label: string | null;
  player_a_email: string;
  player_b_email: string;
  player_a_roblox_username?: string | null;
  player_b_roblox_username?: string | null;
  player_a_display_name?: string | null;
  player_b_display_name?: string | null;
};

function authorLabel(msg: AdminChatRow, match: MatchPlayers): string {
  if (msg.author_is_admin) {
    return process.env.ADMIN_CHAT_NAME ?? "Modération";
  }
  if (msg.author_id === match.player_a) {
    return formatAdminUserLabel({
      roblox_username: match.player_a_roblox_username,
      display_name: match.player_a_display_name,
      match_label: match.player_a_label,
      email: match.player_a_email,
    });
  }
  if (msg.author_id === match.player_b) {
    return formatAdminUserLabel({
      roblox_username: match.player_b_roblox_username,
      display_name: match.player_b_display_name,
      match_label: match.player_b_label,
      email: match.player_b_email,
    });
  }
  return formatAdminUserLabel({
    roblox_username: msg.author_roblox_username,
    display_name: msg.author_display_name,
    email: msg.author_email,
  });
}

function ChatMessageList({
  messages,
  match,
  emptyLabel,
}: {
  messages: AdminChatRow[];
  match: MatchPlayers;
  emptyLabel: string;
}) {
  if (messages.length === 0) {
    return <p className="mt-2 text-sm text-zinc-500">{emptyLabel}</p>;
  }

  return (
    <ul className="mt-3 max-h-96 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
      {messages.map((c) => {
        const isAdmin = c.author_is_admin;
        return (
          <li
            key={c.id}
            className={`rounded-lg border px-3 py-2.5 text-sm ${
              isAdmin
                ? "border-amber-500/25 bg-amber-500/[0.06]"
                : "border-white/8 bg-zinc-950/50"
            }`}
          >
            <p className="text-xs text-zinc-500">
              <span
                className={
                  isAdmin ? "font-semibold text-amber-200/90" : "text-zinc-400"
                }
              >
                {authorLabel(c, match)}
              </span>
              <span className="text-zinc-600">
                {" "}
                · {formatDateTimeFr(c.created_at, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            </p>
            <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-zinc-200">
              {c.body}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminMatchPlayerChat({
  messages,
  match,
}: {
  messages: AdminChatRow[];
  match: MatchPlayers;
}) {
  const playerMessages = messages.filter((m) => !m.author_is_admin);

  return (
    <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-5">
      <h2 className="text-lg font-semibold text-emerald-100">
        Chat entre joueurs ({playerMessages.length})
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Messages échangés dans le chat du match (salon Roblox, ready, accord…),
        y compris avant ou pendant un litige — même fil que dans la salle PVP.
      </p>
      <ChatMessageList
        messages={playerMessages}
        match={match}
        emptyLabel="Aucun message entre les deux joueurs pour ce match."
      />
    </section>
  );
}

export function AdminMatchModerationChat({
  messages,
  match,
  children,
}: {
  messages: AdminChatRow[];
  match: MatchPlayers;
  children?: ReactNode;
}) {
  const adminMessages = messages.filter((m) => m.author_is_admin);

  return (
    <section>
      <h2 className="text-lg font-semibold text-zinc-100">
        Messages modération ({adminMessages.length})
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Réponses envoyées depuis l&apos;admin — visibles par les deux joueurs dans
        leur chat.
      </p>
      {children}
      <ChatMessageList
        messages={adminMessages}
        match={match}
        emptyLabel="Aucun message admin dans le chat."
      />
    </section>
  );
}
