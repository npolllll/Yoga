/**
 * Search normalization shared by the catalog (client) and tests.
 * Handles: case, ё/е, diacritics (Sanskrit IAST), punctuation, Cyrillic↔Latin transliteration
 * and wrong keyboard layout (e.g. "ифлфыфтф" typed instead of "bakasana").
 */

const RU_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

// Physical keyboard mapping ЙЦУКЕН ↔ QWERTY.
const LAYOUT_RU = "йцукенгшщзхъфывапролджэячсмитьбю";
const LAYOUT_EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.";

export function stripDiacritics(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export function normalizeText(value: string): string {
  return stripDiacritics(value.toLowerCase().replace(/ё/g, "е"))
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function transliterate(value: string): string {
  let out = "";
  for (const ch of value) out += RU_TO_LAT[ch] ?? ch;
  return out;
}

/** Latin approximation used to compare words written in different scripts. */
export function phonetic(value: string): string {
  return transliterate(normalizeText(value))
    .replace(/kh/g, "h")
    .replace(/sch|sh/g, "s")
    .replace(/ch/g, "c")
    .replace(/ts/g, "c")
    .replace(/zh/g, "z")
    .replace(/yu/g, "u")
    .replace(/ya/g, "a")
    .replace(/[yj]/g, "i")
    .replace(/w/g, "v")
    .replace(/(.)\1+/g, "$1");
}

export function swapLayout(value: string): string {
  let out = "";
  for (const ch of value.toLowerCase()) {
    const ru = LAYOUT_RU.indexOf(ch);
    const en = LAYOUT_EN.indexOf(ch);
    if (ru >= 0) out += LAYOUT_EN[ru];
    else if (en >= 0) out += LAYOUT_RU[en];
    else out += ch;
  }
  return out;
}

export interface SearchableItem {
  id: string;
  names: string[];
}

export interface SearchIndexEntry {
  id: string;
  text: string; // normalized
  phon: string; // phonetic latin
}

export function buildIndex(items: SearchableItem[]): SearchIndexEntry[] {
  return items.map((item) => {
    const text = normalizeText(item.names.join(" "));
    return { id: item.id, text, phon: phonetic(text) };
  });
}

function matchesQuery(entry: SearchIndexEntry, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const tokens = q.split(" ");
  const compactText = entry.text.replace(/ /g, "");
  const compactPhon = entry.phon.replace(/ /g, "");
  return tokens.every((t) => {
    if (entry.text.includes(t) || compactText.includes(t)) return true;
    const p = phonetic(t);
    return p.length >= 2 && (entry.phon.includes(p) || compactPhon.includes(p));
  });
}

/** Returns ids of matching items; tries the query as typed and with a swapped keyboard layout. */
export function search(index: SearchIndexEntry[], query: string): Set<string> {
  const q = query.trim();
  const result = new Set<string>();
  if (!q) {
    index.forEach((e) => result.add(e.id));
    return result;
  }
  for (const e of index) if (matchesQuery(e, q)) result.add(e.id);
  if (result.size === 0) {
    const swapped = swapLayout(q);
    for (const e of index) if (matchesQuery(e, swapped)) result.add(e.id);
  }
  return result;
}
