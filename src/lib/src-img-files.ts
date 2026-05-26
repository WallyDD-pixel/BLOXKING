import fs from "fs";
import path from "path";

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;

export function getSrcImgFilenames(): string[] {
  try {
    const dir = path.join(process.cwd(), "src", "img");
    if (!fs.existsSync(dir)) {
      return [];
    }
    return fs
      .readdirSync(dir)
      .filter((f) => !f.startsWith(".") && IMAGE_EXT.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  } catch {
    return [];
  }
}
