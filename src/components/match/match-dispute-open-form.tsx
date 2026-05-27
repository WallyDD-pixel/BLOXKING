"use client";

import type { Dispatch, SetStateAction } from "react";
import { DisputeEvidenceUpload } from "@/components/match/dispute-evidence-upload";

type Props = {
  variant: "disagreement" | "early";
  myClaimA: number | null;
  myClaimB: number | null;
  oppClaimA: number | null;
  oppClaimB: number | null;
  draft: string;
  onDraftChange: (value: string) => void;
  evidencePaths: string[];
  setEvidencePaths: Dispatch<SetStateAction<string[]>>;
  pending: boolean;
  evidenceBusy: boolean;
  onPickFiles: (
    fileList: FileList | null,
    currentPaths: string[],
    setPaths: Dispatch<SetStateAction<string[]>>,
  ) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function MatchDisputeOpenForm({
  variant,
  myClaimA,
  myClaimB,
  oppClaimA,
  oppClaimB,
  draft,
  onDraftChange,
  evidencePaths,
  setEvidencePaths,
  pending,
  evidenceBusy,
  onPickFiles,
  onSubmit,
  onCancel,
}: Props) {
  const early = variant === "early";

  return (
    <div className="mt-4 space-y-4 border-t border-red-500/20 pt-4">
      <div className="grid gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-3 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[0.55rem] uppercase tracking-wider text-zinc-500">
            Ton score déclaré (A — B)
          </p>
          <p className="mt-1 font-[family-name:var(--font-bebas)] text-2xl tabular-nums text-white">
            {myClaimA ?? "—"} — {myClaimB ?? "—"}
          </p>
        </div>
        <div>
          <p className="font-mono text-[0.55rem] uppercase tracking-wider text-zinc-500">
            Score déclaré par l&apos;adversaire (A — B)
          </p>
          <p className="mt-1 font-[family-name:var(--font-bebas)] text-2xl tabular-nums text-amber-100/95">
            {oppClaimA ?? "—"} — {oppClaimB ?? "—"}
          </p>
        </div>
      </div>
      <div>
        <label className="block font-mono text-[0.6rem] uppercase tracking-wider text-zinc-400">
          {early
            ? "Décris le problème (déconnexion, triche, bug…)"
            : "Pourquoi estimes-tu avoir raison (et pas l'autre joueur) ?"}
        </label>
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder={
            early
              ? "Explique la situation (min. 10 car.). Tu peux ouvrir un litige même sans avoir déclaré de score — ajoute captures ou vidéo ci-dessous."
              : "Explique clairement (min. 10 car.). Décris le déroulé ; tu peux joindre une vidéo du combat ci-dessous."
          }
          className="mt-2 w-full resize-y rounded-xl border border-white/12 bg-zinc-950/90 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500/35 focus:outline-none focus:ring-1 focus:ring-red-500/25"
        />
        <p className="mt-1 font-mono text-[0.55rem] text-zinc-600">
          {draft.trim().length}/2000
        </p>
      </div>
      <DisputeEvidenceUpload
        paths={evidencePaths}
        setPaths={setEvidencePaths}
        disabled={pending}
        busy={evidenceBusy}
        onPickFiles={(files) => onPickFiles(files, evidencePaths, setEvidencePaths)}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          disabled={pending || draft.trim().length < 10}
          onClick={onSubmit}
          className="min-h-[3rem] rounded-xl border border-red-500/50 bg-red-950/30 px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-red-100 transition-colors hover:bg-red-500/20 disabled:opacity-40 sm:px-6"
        >
          Créer le ticket et ouvrir le litige
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="text-sm text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
