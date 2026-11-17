import type { Locale } from "../config";
import ru, { type Dictionary } from "./ru";
import en from "./en";

const dictionaries: Record<Locale, Dictionary> = { ru, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
