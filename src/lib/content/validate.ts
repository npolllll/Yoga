import type { Localized, PoseDoc, ProgramDoc, ExerciseDoc, PageDoc } from "./schema";
import type { Locale } from "@/lib/i18n/config";
import { LOCALES } from "@/lib/i18n/config";

export type IssueLevel = "error" | "warning";
export interface Issue {
  level: IssueLevel;
  field: string;
  locale?: Locale;
  code: string;
}

export interface DocMeta {
  category_key?: string | null;
  level_key?: string | null;
  skill_keys?: string[] | null;
}

function req(issues: Issue[], field: string, value: Localized | undefined | null, level: IssueLevel = "error") {
  for (const locale of LOCALES) {
    if (!value || !value[locale] || value[locale].trim() === "") {
      issues.push({ level, field, locale, code: "missing_translation" });
    }
  }
}

function reqList(issues: Issue[], field: string, list: Localized[], min: number, level: IssueLevel = "error") {
  if (list.length < min) issues.push({ level, field, code: `min_items_${min}` });
  list.forEach((item, i) => req(issues, `${field}[${i}]`, item, level));
}

export function validatePose(doc: PoseDoc, meta: DocMeta, media?: { animation: boolean; poster: boolean; keyframes: number }): Issue[] {
  const issues: Issue[] = [];
  req(issues, "name", doc.name);
  if (!doc.sanskrit.trim()) issues.push({ level: "warning", field: "sanskrit", code: "missing" });
  req(issues, "summary", doc.summary);
  req(issues, "about", doc.about);
  if (!meta.category_key) issues.push({ level: "error", field: "category", code: "missing" });
  if (!meta.level_key) issues.push({ level: "error", field: "level", code: "missing" });
  if (!meta.skill_keys || meta.skill_keys.length === 0) issues.push({ level: "error", field: "skills", code: "missing" });
  if (doc.steps.length < 3) issues.push({ level: "error", field: "steps", code: "min_items_3" });
  doc.steps.forEach((s, i) => {
    req(issues, `steps[${i}].title`, s.title);
    req(issues, `steps[${i}].body`, s.body);
  });
  reqList(issues, "safety", doc.safety, 1);
  reqList(issues, "prerequisites", doc.prerequisites, 1);
  if (doc.muscles.length === 0) issues.push({ level: "error", field: "muscles", code: "missing" });
  if (doc.mistakes.length === 0) issues.push({ level: "error", field: "mistakes", code: "missing" });
  doc.mistakes.forEach((m, i) => {
    req(issues, `mistakes[${i}].title`, m.title);
    req(issues, `mistakes[${i}].fix`, m.fix);
    req(issues, `mistakes[${i}].why`, m.why, "warning");
  });
  if (doc.prep.length === 0) issues.push({ level: "error", field: "prep", code: "missing" });
  doc.prep.forEach((p, i) => {
    req(issues, `prep[${i}].title`, p.title);
    req(issues, `prep[${i}].body`, p.body);
  });
  for (const locale of LOCALES) {
    if (!doc.video[locale]) issues.push({ level: "warning", field: "video", locale, code: "missing_video" });
  }
  if (media) {
    if (!media.animation) issues.push({ level: "warning", field: "media.animation", code: "missing" });
    if (!media.poster) issues.push({ level: "warning", field: "media.poster", code: "missing" });
    if (media.keyframes < 4) issues.push({ level: "warning", field: "media.keyframes", code: "min_items_4" });
  }
  return issues;
}

export function validateProgram(doc: ProgramDoc, meta: DocMeta): Issue[] {
  const issues: Issue[] = [];
  req(issues, "title", doc.title);
  req(issues, "summary", doc.summary);
  req(issues, "description", doc.description);
  req(issues, "audience", doc.audience, "warning");
  if (!meta.level_key) issues.push({ level: "error", field: "level", code: "missing" });
  if (doc.steps.length === 0) issues.push({ level: "error", field: "steps", code: "missing" });
  const keys = new Set<string>();
  doc.steps.forEach((s, i) => {
    if (keys.has(s.key)) issues.push({ level: "error", field: `steps[${i}].key`, code: "duplicate_key" });
    keys.add(s.key);
    req(issues, `steps[${i}].title`, s.title);
    req(issues, `steps[${i}].body`, s.body, s.kind === "lesson" ? "error" : "warning");
    if (s.kind === "pose" && !s.poseId) issues.push({ level: "error", field: `steps[${i}].poseId`, code: "missing" });
    if (s.kind === "exercise" && !s.exerciseId)
      issues.push({ level: "error", field: `steps[${i}].exerciseId`, code: "missing" });
  });
  return issues;
}

export function validateExercise(doc: ExerciseDoc): Issue[] {
  const issues: Issue[] = [];
  req(issues, "name", doc.name);
  req(issues, "summary", doc.summary);
  reqList(issues, "instructions", doc.instructions, 1);
  return issues;
}

export function validatePage(doc: PageDoc): Issue[] {
  const issues: Issue[] = [];
  req(issues, "title", doc.title);
  doc.sections.forEach((s, i) => {
    req(issues, `sections[${i}].heading`, s.heading);
    req(issues, `sections[${i}].body`, s.body);
  });
  doc.items.forEach((s, i) => {
    req(issues, `items[${i}].q`, s.q);
    req(issues, `items[${i}].a`, s.a);
  });
  for (const [key, value] of Object.entries(doc.blocks)) req(issues, `blocks.${key}`, value);
  return issues;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.level === "error");
