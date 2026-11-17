import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Brand illustrations rendered by the 3D pipeline (pipeline/brand.py) into public/media/brand/.
 * Missing files fall back to vector placeholders, so pages never show broken images.
 */
export interface BrandImage {
  url: string;
  width: number;
  height: number;
}

let manifest: Record<string, BrandImage> | null = null;

export function brandImage(key: string): BrandImage | null {
  if (!manifest) {
    const file = join(process.cwd(), "public", "media", "brand", "manifest.json");
    manifest = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, BrandImage>) : {};
  }
  return manifest[key] ?? null;
}
