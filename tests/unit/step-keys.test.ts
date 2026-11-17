import { describe, expect, it } from "vitest";
import { duplicateItem, moveItem, normalizeKeys, programProgress, isValidKey } from "@/lib/content/step-keys";

describe("step keys", () => {
  const a = { key: "0b8f3c1e-8a52-4c7e-9d3b-1f2a3b4c5d6e", t: "a" };
  const b = { key: "1c9e4d2f-9b63-4d8f-8e4c-2a3b4c5d6e7f", t: "b" };
  it("keeps valid unique keys and fixes duplicates/invalid", () => {
    const out = normalizeKeys([a, b, { ...a, t: "dup" }, { key: "x", t: "bad" }]);
    expect(out[0].key).toBe(a.key);
    expect(out[1].key).toBe(b.key);
    expect(out[2].key).not.toBe(a.key);
    expect(isValidKey(out[3].key)).toBe(true);
    expect(new Set(out.map((s) => s.key)).size).toBe(4);
  });
  it("duplicate creates a new key", () => {
    expect(duplicateItem(a).key).not.toBe(a.key);
  });
  it("reordering keeps keys and progress", () => {
    const moved = moveItem([a, b], 0, 1);
    expect(moved.map((s) => s.key)).toEqual([b.key, a.key]);
    const p1 = programProgress([a.key, b.key], [a.key]);
    const p2 = programProgress(moved.map((s) => s.key), [a.key]);
    expect(p1.completed).toBe(1);
    expect(p2.completed).toBe(1);
    expect(p2.nextKey).toBe(b.key);
  });
  it("ignores completions of removed steps", () => {
    expect(programProgress([b.key], [a.key])).toMatchObject({ total: 1, completed: 0, percent: 0 });
  });
});
