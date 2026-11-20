import { describe, expect, it } from "vitest";
import { sniffMediaType } from "@/lib/media-sniff";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)).concat(Array(16).fill(0)));

describe("sniffMediaType (upload validation by content, not by declared type)", () => {
  it("recognises the allowed formats", () => {
    expect(sniffMediaType(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffMediaType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMediaType(bytes("RIFF", [0, 0, 0, 0], "WEBP"))).toBe("image/webp");
    expect(sniffMediaType(bytes([0, 0, 0, 0x1c], "ftypavif"))).toBe("image/avif");
    expect(sniffMediaType(bytes([0, 0, 0, 0x20], "ftypisom"))).toBe("video/mp4");
    expect(sniffMediaType(bytes([0x1a, 0x45, 0xdf, 0xa3]))).toBe("video/webm");
  });
  it("rejects HTML, SVG, scripts and truncated files whatever their declared type", () => {
    expect(sniffMediaType(bytes("<!doctype html><script>"))).toBeNull();
    expect(sniffMediaType(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffMediaType(bytes("GIF89a"))).toBeNull();
    expect(sniffMediaType(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});
