"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  matchRequestCancellation,
  type MatchCancellationRequestRow,
} from "@/app/play/actions";

type Props = {
  matchId: string;
  userId: string;
  initialRequests: MatchCancellationRequestRow[];
};

export function MatchCancellationRequest({
  matchId,
  userId,
  initialRequests,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [requests, setRequests] =
    useState<MatchCancellationRequestRow[]>(initialRequests);

  const myOpen = requests.find(
    (r) => r.requested_by === userId && r.status === "open",
  );
  const otherOpen = requests.filter(
    (r) => r.requested_by !== userId && r.status === "open",
  );

  function submit() {
    setErr(null);
    startTransition(async () => {
      const res = await matchRequestCancellation(matchId, reason);
      if (res.error) {
        setErr(res.error);
        return;
      }
      const now = new Date().toISOString();
      if (myOpen) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === myOpen.id ? { ...r, reason: reason.trim(), created_at: now } : r,
          ),
        );
      } else {
        setRequests((prev) => [
          {
            id: crypto.randomUUID(),
            requested_by: userId,
            reason: reason.trim(),
            status: "open",
            created_at: now,
          },
          ...prev,
        ]);
      }
      setReason("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-700/70 bg-zinc-950/55 px-4 py-5 sm:px-6 sm:py-6">
      <h2 className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">
        Demander l&apos;annulation
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-zinc-500">
        Si la partie ne peut pas se terminer normalement (déconnexion, bug, accord
        mutuel…), décris la situation. Un modérateur pourra annuler le match
        depuis l&apos;administration.
      </p>

      {myOpen ? (
        <div
          className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-4 py-3.5 text-sm text-amber-100/95"
          role="status"
        >
          <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-amber-200/90">
            Demande en attente
          </p>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed">{myOpen.reason}</p>
          <p className="mt-2 text-xs text-amber-200/70">
            Envoyée le{" "}
            {new Date(myOpen.created_at).toLocaleString("fr-FR")}. Tu peux
            modifier le texte ci-dessous pour mettre à jour ta demande.
          </p>
        </div>
      ) : null}

      {otherOpen.length > 0 ? (
        <p className="mt-3 text-xs text-zinc-500">
          L&apos;adversaire a aussi demandé l&apos;annulation — la modération
          traitera les deux demandes.
        </p>
      ) : null}

      <label className="mt-4 block text-sm text-zinc-400">
        Raison (min. 10 caractères)
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Ex. : adversaire déconnecté après la manche 1, impossible de finir le BO3…"
          className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600"
        />
      </label>

      {err ? (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending || reason.trim().length < 10}
        onClick={submit}
        className="mt-4 rounded-xl border border-zinc-600/80 bg-zinc-900/80 px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-40"
      >
        {myOpen ? "Mettre à jour la demande" : "Envoyer la demande d'annulation"}
      </button>
    </section>
  );
}
