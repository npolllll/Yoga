/**
 * Program step identity rules:
 *  - every step has a permanent UUID `key`, independent from its position;
 *  - reordering keeps keys (member progress is bound to keys);
 *  - duplicating/copying a step always produces a NEW key;
 *  - if a document somehow contains duplicate keys, later duplicates get fresh keys.
 */
export interface Keyed {
  key: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function newKey(): string {
  return crypto.randomUUID();
}

export function isValidKey(key: unknown): key is string {
  return typeof key === "string" && UUID_RE.test(key);
}

export function normalizeKeys<T extends Keyed>(items: T[], reserved: Iterable<string> = []): T[] {
  const seen = new Set<string>(reserved);
  return items.map((item) => {
    if (!isValidKey(item.key) || seen.has(item.key.toLowerCase())) {
      const key = newKey();
      seen.add(key);
      return { ...item, key };
    }
    seen.add(item.key.toLowerCase());
    return item;
  });
}

export function duplicateItem<T extends Keyed>(item: T): T {
  return { ...structuredClone(item), key: newKey() };
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
  const copy = items.slice();
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

/** Progress of a program computed against the CURRENT step keys only (removed steps are ignored). */
export function programProgress(stepKeys: string[], completed: Iterable<string>) {
  const done = new Set(completed);
  const completedCount = stepKeys.filter((k) => done.has(k)).length;
  const nextIndex = stepKeys.findIndex((k) => !done.has(k));
  return {
    total: stepKeys.length,
    completed: completedCount,
    percent: stepKeys.length === 0 ? 0 : Math.round((completedCount / stepKeys.length) * 100),
    nextKey: nextIndex === -1 ? null : stepKeys[nextIndex],
  };
}
