/**
 * Detects the real type of an uploaded media file from its first bytes (the browser-declared MIME type and the
 * file name are client input and are not trusted). Returns null for anything that is not one of the allowed
 * formats.
 */
export type MediaType = "image/png" | "image/jpeg" | "image/webp" | "image/avif" | "video/mp4" | "video/webm";

export const EXTENSION: Record<MediaType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

export function sniffMediaType(b: Uint8Array): MediaType | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && ascii(b, 1, 4) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  if (ascii(b, 4, 8) === "ftyp") {
    const major = ascii(b, 8, 12);
    if (major === "avif" || major === "avis") return "image/avif";
    if (["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash"].includes(major)) return "video/mp4";
  }
  return null;
}
