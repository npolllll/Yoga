/**
 * Validates content source files against the zod schemas and editorial rules.
 * Usage: pnpm exec tsx scripts/validate-content.ts [files...]   (no args = all files)
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PoseDoc, ExerciseDoc, ProgramDoc, PageDoc, MUSCLE_KEYS } from "../src/lib/content/schema";
import { validatePose, validateExercise, validateProgram, validatePage } from "../src/lib/content/validate";

const ROOT = join(__dirname, "..");
const catalog = JSON.parse(readFileSync(join(ROOT, "content/catalog.json"), "utf8")) as {
  poses: { slug: string; category: string; level: string }[];
  exercises: { slug: string }[];
};
const poseSlugs = new Set(catalog.poses.map((p) => p.slug));
const exerciseSlugs = new Set(catalog.exercises.map((e) => e.slug));
const SKILLS = new Set([
  "arm-strength", "flexibility", "shoulder-mobility", "hip-openness", "core-control",
  "wrist-strength", "balance-coordination", "inversion", "hamstring-flexibility", "twist",
]);
const LEVELS = new Set(["beginner", "intermediate", "advanced", "expert"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let failed = 0;
function fail(file: string, msg: string) {
  failed++;
  console.error(`✗ ${file}: ${msg}`);
}

function checkPose(file: string, raw: Record<string, unknown>) {
  const slug = raw.slug as string;
  const entry = catalog.poses.find((p) => p.slug === slug);
  if (!entry) return fail(file, `slug ${slug} not in catalog.json`);
  if (raw.category !== entry.category) fail(file, `category ${raw.category} != catalog ${entry.category}`);
  if (raw.level !== entry.level) fail(file, `level ${raw.level} != catalog ${entry.level}`);
  if (!LEVELS.has(raw.level as string)) fail(file, "invalid level");
  const skills = raw.skills as string[];
  if (!Array.isArray(skills) || skills.length === 0 || skills.some((s) => !SKILLS.has(s))) fail(file, "invalid skills");
  const motion = raw.motion as Record<string, unknown> | undefined;
  if (!motion || !motion.entry || !motion.hold || !motion.view) fail(file, "motion brief incomplete");
  const parsed = PoseDoc.safeParse(raw.doc);
  if (!parsed.success) return fail(file, `schema: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const doc = parsed.data;
  const issues = validatePose(doc, { category_key: entry.category, level_key: entry.level, skill_keys: skills });
  for (const i of issues.filter((x) => x.level === "error")) fail(file, `${i.field}${i.locale ? ` [${i.locale}]` : ""}: ${i.code}`);
  if (doc.steps.length < 4 || doc.steps.length > 6) fail(file, `steps: expected 4-6, got ${doc.steps.length}`);
  doc.steps.forEach((s, i) => {
    if (!UUID.test(s.key)) fail(file, `steps[${i}].key is not uuid v4`);
    if (s.keyframe !== undefined && (s.keyframe < 0 || s.keyframe > 4)) fail(file, `steps[${i}].keyframe out of 0-4`);
  });
  if (new Set(doc.steps.map((s) => s.key)).size !== doc.steps.length) fail(file, "duplicate step keys");
  for (const k of [...doc.easier, ...doc.harder, ...doc.related]) if (!poseSlugs.has(k)) fail(file, `unknown pose slug ${k}`);
  for (const p of doc.prep) if (p.exerciseSlug && !exerciseSlugs.has(p.exerciseSlug)) fail(file, `unknown exercise ${p.exerciseSlug}`);
  for (const m of doc.muscles) if (!(MUSCLE_KEYS as readonly string[]).includes(m.key)) fail(file, `unknown muscle ${m.key}`);
  if (doc.video.ru || doc.video.en) fail(file, "video links must not be added in source content (verified separately)");
  const phases = doc.animationPhases;
  if (phases.length < 3) fail(file, "animationPhases: at least 3");
  else {
    if (phases[0].fromSec !== 0 || phases[phases.length - 1].toSec !== 10) fail(file, "animationPhases must cover 0-10s");
    phases.forEach((p, i) => {
      if (p.toSec <= p.fromSec) fail(file, `animationPhases[${i}] invalid range`);
      if (i > 0 && p.fromSec !== phases[i - 1].toSec) fail(file, `animationPhases[${i}] not contiguous`);
    });
  }
  if (doc.mistakes.length < 2 || doc.mistakes.length > 4) fail(file, "mistakes: expected 2-4");
  const all = JSON.stringify(doc);
  if (/youtube\.com|youtu\.be/i.test(all)) fail(file, "contains YouTube links");
  if (/(вылеч|излеч|гарантир|cure|guarantee|injury[- ]free|без травм)/i.test(all)) fail(file, "contains medical/guarantee claims");
}

function checkFile(path: string) {
  const file = path.replace(ROOT + "/", "");
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return fail(file, `invalid JSON: ${(e as Error).message}`);
  }
  if (file.includes("content/poses/")) checkPose(file, raw);
  else if (file.includes("content/exercises/")) {
    if (!exerciseSlugs.has(raw.slug as string)) fail(file, `slug ${raw.slug} not in catalog`);
    const r = ExerciseDoc.safeParse(raw.doc);
    if (!r.success) return fail(file, `schema: ${r.error.message}`);
    for (const i of validateExercise(r.data).filter((x) => x.level === "error")) fail(file, `${i.field}${i.locale ? ` [${i.locale}]` : ""}: ${i.code}`);
  } else if (file.includes("content/programs/")) {
    const r = ProgramDoc.safeParse(raw.doc);
    if (!r.success) return fail(file, `schema: ${r.error.message}`);
    if (!LEVELS.has(raw.level as string)) fail(file, "invalid level");
    const steps = (raw.doc as { steps: Record<string, unknown>[] }).steps;
    const keys = new Set<string>();
    steps.forEach((s, i) => {
      const key = s.key as string;
      if (!UUID.test(key)) fail(file, `steps[${i}].key is not uuid v4`);
      if (keys.has(key)) fail(file, `steps[${i}] duplicate key`);
      keys.add(key);
      if (s.kind === "pose" && !poseSlugs.has(s.poseSlug as string)) fail(file, `steps[${i}] unknown poseSlug ${s.poseSlug}`);
      if (s.kind === "exercise" && !exerciseSlugs.has(s.exerciseSlug as string)) fail(file, `steps[${i}] unknown exerciseSlug ${s.exerciseSlug}`);
      if (s.kind === "lesson" && (s.poseSlug || s.exerciseSlug)) fail(file, `steps[${i}] lesson must not reference pose/exercise`);
    });
    const withIds = { ...r.data, steps: r.data.steps.map((s, i) => ({ ...s, poseId: steps[i].poseSlug ? "00000000-0000-4000-8000-000000000000" : undefined, exerciseId: steps[i].exerciseSlug ? "00000000-0000-4000-8000-000000000000" : undefined })) };
    for (const i of validateProgram(withIds, { level_key: raw.level as string }).filter((x) => x.level === "error"))
      fail(file, `${i.field}${i.locale ? ` [${i.locale}]` : ""}: ${i.code}`);
  } else if (file.includes("content/pages/")) {
    const r = PageDoc.safeParse(raw.doc);
    if (!r.success) return fail(file, `schema: ${r.error.message}`);
    for (const i of validatePage(r.data).filter((x) => x.level === "error")) fail(file, `${i.field}${i.locale ? ` [${i.locale}]` : ""}: ${i.code}`);
  }
  if (!failed) console.log(`✓ ${file}`);
}

const args = process.argv.slice(2);
const files =
  args.length > 0
    ? args.map((a) => (a.startsWith("/") ? a : join(process.cwd(), a)))
    : ["poses", "exercises", "programs", "pages"].flatMap((d) => {
        const dir = join(ROOT, "content", d);
        return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f)) : [];
      });
for (const f of files) checkFile(f);
// unused imports guard for program/page validators (kept for future rules)
void validateProgram;
if (failed) {
  console.error(`\n${failed} problem(s)`);
  process.exit(1);
}
console.log(`\nAll ${files.length} file(s) valid.`);
