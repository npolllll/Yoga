import type { CatalogPose, Level } from "./public";
import type { Locale } from "@/lib/i18n/config";
import { t } from "@/lib/i18n/paths";
import type { LibraryPose } from "@/components/pose/Library";

export function levelInfo(levels: Level[], key: string, locale: Locale) {
  const level = levels.find((l) => l.key === key);
  return { rank: level?.rank ?? 1, label: level ? t(level.label, locale) : key };
}

/** Card subtitle: Sanskrit when available, otherwise the name in the other language. */
export function secondaryName(pose: Pick<CatalogPose, "sanskrit" | "name">, locale: Locale) {
  if (pose.sanskrit) return pose.sanskrit;
  return locale === "ru" ? pose.name.en : "";
}

export function toLibraryPose(pose: CatalogPose, levels: Level[], locale: Locale): LibraryPose {
  const level = levelInfo(levels, pose.levelKey, locale);
  return {
    id: pose.id,
    slug: pose.slug,
    name: t(pose.name, locale),
    secondary: secondaryName(pose, locale),
    levelRank: level.rank,
    levelLabel: level.label,
    card: pose.card,
    names: [pose.name.ru, pose.name.en, pose.sanskrit, pose.subtitle?.ru ?? "", pose.subtitle?.en ?? "", ...pose.altNames].filter(Boolean),
    levelKey: pose.levelKey,
    categoryKey: pose.categoryKey,
    skillKeys: pose.skillKeys,
    sortWeight: pose.sortWeight,
  };
}
