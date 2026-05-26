import "server-only";

import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { disputeEvidenceAbsolutePath } from "@/lib/storage/dispute-evidence-server";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

function extFromPath(objectPath: string): string {
  return objectPath.split("/").pop()?.split(".").pop()?.toLowerCase() ?? "";
}

export async function serveDisputeEvidenceFile(
  objectPath: string,
  request: Request,
): Promise<Response> {
  const full = disputeEvidenceAbsolutePath(objectPath);
  const st = await stat(full);
  const ext = extFromPath(objectPath);
  const contentType = MIME[ext] ?? "application/octet-stream";
  const isVideo = ext === "mp4" || ext === "webm";

  const range = request.headers.get("range");
  if (isVideo && range) {
    const m = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (m) {
      const start = Number.parseInt(m[1], 10);
      const end = m[2] ? Number.parseInt(m[2], 10) : st.size - 1;
      if (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start >= 0 &&
        end < st.size &&
        start <= end
      ) {
        const len = end - start + 1;
        const stream = createReadStream(full, { start, end });
        return new Response(stream as unknown as BodyInit, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(len),
            "Content-Range": `bytes ${start}-${end}/${st.size}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=86400",
          },
        });
      }
    }
  }

  const stream = createReadStream(full);
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": String(st.size),
    "Cache-Control": "private, max-age=86400",
  };
  if (isVideo) {
    headers["Accept-Ranges"] = "bytes";
  }

  return new Response(stream as unknown as BodyInit, { headers });
}
