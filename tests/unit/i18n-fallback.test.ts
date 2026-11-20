import { describe, expect, it } from "vitest";
import { safeNext, t } from "@/lib/i18n/paths";

describe("localized text fallback (spec §4: never show an empty field)", () => {
  it("returns the requested language when present", () => {
    expect(t({ ru: "Ворона", en: "Crow" }, "ru")).toBe("Ворона");
    expect(t({ ru: "Ворона", en: "Crow" }, "en")).toBe("Crow");
  });
  it("falls back to the other language when a translation is missing or blank", () => {
    expect(t({ ru: "Ворона", en: "" }, "en")).toBe("Ворона");
    expect(t({ ru: "  ", en: "Crow" }, "ru")).toBe("Crow");
  });
  it("handles absent values", () => {
    expect(t(undefined, "ru")).toBe("");
    expect(t(null, "en")).toBe("");
  });
});

describe("safeNext (no open redirects after sign-in)", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNext("/ru/poses/bakasana?intent=fav", "/ru")).toBe("/ru/poses/bakasana?intent=fav");
  });
  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNext("https://evil.example/x", "/ru")).toBe("/ru");
    expect(safeNext("//evil.example/x", "/ru")).toBe("/ru");
    expect(safeNext("/\\evil.example", "/ru")).toBe("/ru");
    expect(safeNext(null, "/en")).toBe("/en");
  });
});
