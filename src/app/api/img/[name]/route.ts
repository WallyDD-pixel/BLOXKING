import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const IMG_DIR = path.resolve(process.cwd(), "src", "img");

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name: raw } = await context.params;
  const decoded = decodeURIComponent(raw);
  if (
    !decoded ||
    decoded.includes("..") ||
    decoded.includes("/") ||
    decoded.includes("\\")
  ) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!/\.(png|jpe?g|webp|gif|svg)$/i.test(decoded)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.resolve(IMG_DIR, decoded);
  const relative = path.relative(IMG_DIR, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buf = fs.readFileSync(filePath);
  const ext = path.extname(decoded).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";

  return new NextResponse(buf, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
