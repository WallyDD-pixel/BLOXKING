"use client";

import type { Dispatch, SetStateAction } from "react";
import { DisputeEvidencePreview } from "@/components/match/dispute-evidence-preview";
import {
  countVideosInPaths,
  DISPUTE_MAX_ATTACHMENTS,
  DISPUTE_VIDEO_MAX_BYTES,
} from "@/lib/dispute-evidence";
import { disputeEvidencePublicUrl } from "@/lib/storage/dispute-evidence-url";

const VIDEO_MAX_MB = Math.round(DISPUTE_VIDEO_MAX_BYTES / (1024 * 1024));

export function DisputeEvidenceUpload({
  paths,
  setPaths,
  disabled,
  busy,
  onPickFiles,
}: {
  paths: string[];
  setPaths: Dispatch<SetStateAction<string[]>>;
  disabled: boolean;
  busy: boolean;
  onPickFiles: (
    files: FileList,
    currentPaths: string[],
    setPaths: Dispatch<SetStateAction<string[]>>,
  ) => void | Promise<void>;
}) {
  const hasVideo = countVideosInPaths(paths) > 0;
  const atMax = paths.length >= DISPUTE_MAX_ATTACHMENTS;

  return (
    <div className="space-y-3">
      <p className="font-mono text-[0.6rem] uppercase tracking-wider text-zinc-500">
        Preuves (optionnel) · max {DISPUTE_MAX_ATTACHMENTS} fichiers · 1 vidéo max ·
        images 2,5 Mo · vidéo {VIDEO_MAX_MB} Mo (MP4 ou WebM)
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-white/15 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300 hover:border-amber-500/30">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={disabled || busy || atMax}
            onChange={(e) => {
              void onPickFiles(e.target.files!, paths, setPaths);
              e.target.value = "";
            }}
          />
          {busy ? "Envoi…" : "Images"}
        </label>
        <label className="cursor-pointer rounded-lg border border-white/15 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300 hover:border-sky-500/30">
          <input
            type="file"
            accept="video/mp4,video/webm,.mp4,.webm"
            className="sr-only"
            disabled={disabled || busy || atMax || hasVideo}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                const dt = new DataTransfer();
                dt.items.add(f);
                void onPickFiles(dt.files, paths, setPaths);
              }
              e.target.value = "";
            }}
          />
          {busy ? "Envoi…" : hasVideo ? "Vidéo ajoutée" : "Vidéo combat"}
        </label>
        <span className="font-mono text-[0.55rem] text-zinc-600">
          {paths.length}/{DISPUTE_MAX_ATTACHMENTS}
        </span>
      </div>
      {paths.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {paths.map((p) => (
            <li key={p} className="relative max-w-[14rem]">
              <DisputeEvidencePreview
                url={disputeEvidencePublicUrl(p)}
                objectPath={p}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => setPaths((prev) => prev.filter((x) => x !== p))}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 text-xs text-zinc-300 hover:bg-red-950/80"
                aria-label="Retirer ce fichier"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
