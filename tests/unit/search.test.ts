import { describe, expect, it } from "vitest";
import { buildIndex, normalizeText, search, swapLayout } from "@/lib/search/normalize";

const index = buildIndex([
  { id: "crow", names: ["Бакасана", "Поза ворона", "Crow Pose", "Bakasana", "Kakasana", "Какасана", "Bakāsana"] },
  { id: "hs", names: ["Стойка на руках", "Handstand", "Adho Mukha Vrksasana", "Адхо Мукха Врикшасана"] },
  { id: "firefly", names: ["Светлячок", "Firefly Pose", "Tittibhasana", "Титтибхасана"] },
]);

describe("search normalization", () => {
  it("normalizes case, ё and diacritics", () => {
    expect(normalizeText("Ёлка  Bakāsana!")).toBe("елка bakasana");
  });
  it.each([
    ["бакасана", "crow"],
    ["Bakasana", "crow"],
    ["bakāsana", "crow"],
    ["crow", "crow"],
    ["ворона", "crow"],
    ["kakasana", "crow"],
    ["какасана", "crow"],
    ["ифлфыфтф", "crow"],
    ["адхо мукха", "hs"],
    ["adho mukha vrksasana", "hs"],
    ["врикшасана", "hs"],
    ["titibhasana", "firefly"],
    ["tittibhasana", "firefly"],
  ])("query %s finds %s", (query, id) => {
    expect(search(index, query).has(id)).toBe(true);
  });
  it("returns everything for empty query and nothing for nonsense", () => {
    expect(search(index, "").size).toBe(3);
    expect(search(index, "zzzzqqq").size).toBe(0);
  });
  it("swaps keyboard layout", () => {
    expect(swapLayout("ифлфыфтф")).toBe("bakasana");
  });
});
