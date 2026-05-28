"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  adminApplyBlame,
  adminBanUser,
  adminClearBlame,
  adminUnbanUser,
} from "@/app/admin/actions";
import {
  BLAME_FAIR_WINS_REQUIRED,
  BLAME_LOSS_ELO_MULTIPLIER,
} from "@/lib/moderation/blame-constants";
import type { PlayerModerationStatus } from "@/lib/moderation/player-status";

type Props = {
  matchId: string;
  playerA: PlayerModerationStatus;
  playerB: PlayerModerationStatus;
  canManageBans?: boolean;
};

function PlayerModerationCard({
  matchId,
  player,
  canManageBans,
}: {
  matchId: string;
  player: PlayerModerationStatus;
  canManageBans: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [banReason, setBanReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const label =
    player.roblox_username ??
    player.display_name ??
    player.email;

  function run(action: () => Promise<{ ok?: true; error?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) setMessage(res.error);
      else {
        setMessage("OK");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-4">
      <p className="font-medium text-zinc-100">{label}</p>
      <p className="text-xs text-zinc-500">{player.email}</p>

      <dl className="mt-3 space-y-1 text-sm">
        {player.banned_at ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-100">
            <dt className="font-semibold">Banni</dt>
            <dd className="mt-1 text-xs opacity-90">
              {player.ban_reason ?? "Sans motif"}
            </dd>
          </div>
        ) : null}
        {player.blame_active ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-100">
            <dt className="font-semibold">Blame actif</dt>
            <dd className="mt-1 text-xs">
              Victoires loyales : {player.blame_fair_wins_done}/
              {player.blame_fair_wins_required || BLAME_FAIR_WINS_REQUIRED}
              <br />
              Défaite : ELO ×{BLAME_LOSS_ELO_MULTIPLIER}
              {player.blame_note ? (
                <>
                  <br />
                  Note : {player.blame_note}
                </>
              ) : null}
            </dd>
          </div>
        ) : (
          <div className="text-zinc-500">
            Blames historiques : {player.blame_count}
          </div>
        )}
      </dl>

      {!player.banned_at ? (
        <div className="mt-4 space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motif du blame (signalement, triche suspectée…)"
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || player.blame_active}
              onClick={() =>
                run(() =>
                  adminApplyBlame(player.user_id, matchId, note || undefined),
                )
              }
              className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
            >
              Appliquer un blame
            </button>
            {player.blame_active ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => adminClearBlame(player.user_id))}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5 disabled:opacity-50"
              >
                Retirer le blame
              </button>
            ) : null}
          </div>

          {canManageBans ? (
            <>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Motif du ban (récidive…)"
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => adminBanUser(player.user_id, banReason || undefined))
                }
                className="rounded-lg border border-red-500/50 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/25 disabled:opacity-50"
              >
                Bannir du site
              </button>
            </>
          ) : (
            <p className="text-xs text-zinc-600">
              Ban réservé aux administrateurs complets.
            </p>
          )}
        </div>
      ) : canManageBans ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => adminUnbanUser(player.user_id))}
          className="mt-4 rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5 disabled:opacity-50"
        >
          Lever le ban
        </button>
      ) : null}

      {message ? (
        <p
          className={`mt-2 text-xs ${message === "OK" ? "text-emerald-400" : "text-red-400"}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function AdminDisputeModeration({
  matchId,
  playerA,
  playerB,
  canManageBans = false,
}: Props) {
  return (
    <section className="rounded-xl border border-red-500/25 bg-red-500/[0.04] p-5">
      <h2 className="text-lg font-semibold text-zinc-100">
        Sanctions joueurs (blame / ban)
      </h2>
      <p className="mt-1 text-sm text-zinc-400">
        Blame : le joueur doit gagner{" "}
        <strong className="text-zinc-200">{BLAME_FAIR_WINS_REQUIRED} matchs</strong>{" "}
        à la loyale (sans litige) pour le retirer. En blame, une défaite coûte environ{" "}
        <strong className="text-zinc-200">×{BLAME_LOSS_ELO_MULTIPLIER} ELO</strong>.
        Ban en cas de récidive.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PlayerModerationCard
          matchId={matchId}
          player={playerA}
          canManageBans={canManageBans}
        />
        <PlayerModerationCard
          matchId={matchId}
          player={playerB}
          canManageBans={canManageBans}
        />
      </div>
    </section>
  );
}
