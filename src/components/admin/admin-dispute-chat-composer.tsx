"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminPostDisputeChatMessage } from "@/app/admin/actions";

export function AdminDisputeChatComposer({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const disabled = pending || body.trim().length === 0;

  const send = () => {
    setError(null);
    startTransition(async () => {
      const res = await adminPostDisputeChatMessage(matchId, body);
      if (res.error) {
        setError(res.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
      <p className="text-sm font-semibold text-zinc-100">Message admin</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm text-zinc-400">
          <span className="sr-only">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Écris un message visible par les deux joueurs…"
            className="block w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={send}
          className="h-10 rounded-lg bg-amber-500 px-4 text-sm font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          Envoyer
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <p className="mt-2 text-xs text-zinc-600">
        Le message est posté dans le chat litige avec ton compte admin.
      </p>
    </div>
  );
}

