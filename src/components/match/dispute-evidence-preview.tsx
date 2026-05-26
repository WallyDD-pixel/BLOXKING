import { evidencePathKind } from "@/lib/dispute-evidence";

export function DisputeEvidencePreview({
  url,
  objectPath,
}: {
  url: string;
  objectPath?: string;
}) {
  const kind =
    objectPath != null
      ? evidencePathKind(objectPath)
      : url.toLowerCase().includes(".mp4") || url.toLowerCase().includes(".webm")
        ? "video"
        : "image";

  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="max-h-56 w-full max-w-[min(100%,20rem)] rounded-lg border border-white/10 bg-black"
      >
        <track kind="captions" />
      </video>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Pièce jointe du ticket"
      className="max-h-36 max-w-[min(100%,14rem)] rounded-lg border border-white/10 object-cover"
    />
  );
}
