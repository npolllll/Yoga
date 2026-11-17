import { z } from "zod";

/**
 * Content schemas. Every entity is ONE document with localized fields ({ ru, en }).
 * Drafts may contain empty strings; publish-time completeness is checked in ./validate.ts.
 */

export const Localized = z.object({ ru: z.string().max(8000), en: z.string().max(8000) });
export type Localized = z.infer<typeof Localized>;
export const emptyLocalized = (): Localized => ({ ru: "", en: "" });

export const SlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug: lowercase latin letters, digits and hyphens");

export const MUSCLE_KEYS = [
  "wrists-forearms",
  "shoulders-deltoids",
  "serratus",
  "triceps",
  "biceps",
  "chest",
  "upper-back",
  "lats",
  "core-abs",
  "obliques",
  "lower-back",
  "hip-flexors",
  "glutes",
  "adductors",
  "hamstrings",
  "quadriceps",
  "calves-ankles",
  "neck",
] as const;
export const MuscleKey = z.enum(MUSCLE_KEYS);
export type MuscleKey = z.infer<typeof MuscleKey>;

export const VideoRef = z.object({
  provider: z.enum(["youtube", "vk", "rutube", "other"]),
  /** Provider video id (YouTube 11-char id). */
  videoId: z.string().max(64).optional(),
  url: z.url(),
  title: z.string().min(1).max(200),
  author: z.string().min(1).max(120),
  durationSec: z.number().int().positive().optional(),
  startSec: z.number().int().min(0).optional(),
  /** Internal note for reviewers (e.g. timestamp where the pose is demonstrated). Not shown publicly. */
  reviewNote: z.string().max(500).optional(),
  /** Date (YYYY-MM-DD) when availability/embeddability was last verified. */
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  embeddable: z.boolean().optional(),
});
export type VideoRef = z.infer<typeof VideoRef>;

export const LocalizedVideo = z.object({
  ru: VideoRef.nullable().optional(),
  en: VideoRef.nullable().optional(),
});

export const SourceRef = z.object({
  title: z.string().min(1).max(300),
  url: z.url().optional(),
  note: z.string().max(500).optional(),
});

const StepKey = z.uuid();

export const PoseStep = z.object({
  key: StepKey,
  title: Localized,
  body: Localized,
  /** Index of the animation keyframe (0-based) that illustrates this step. */
  keyframe: z.number().int().min(0).max(9).optional(),
});

export const PoseDoc = z.object({
  name: Localized,
  subtitle: Localized.optional(),
  sanskrit: z.string().max(120),
  altNames: z.array(z.string().min(1).max(120)).max(30).default([]),
  summary: Localized,
  about: Localized,
  prerequisites: z.array(Localized).max(12).default([]),
  safety: z.array(Localized).max(12).default([]),
  steps: z.array(PoseStep).max(12).default([]),
  muscles: z.array(z.object({ key: MuscleKey, note: Localized.optional() })).max(14).default([]),
  anatomy: Localized.optional(),
  prep: z
    .array(z.object({ exerciseSlug: SlugSchema.optional(), title: Localized, body: Localized }))
    .max(10)
    .default([]),
  mistakes: z.array(z.object({ title: Localized, why: Localized, fix: Localized })).max(10).default([]),
  easier: z.array(SlugSchema).max(10).default([]),
  harder: z.array(SlugSchema).max(10).default([]),
  related: z.array(SlugSchema).max(12).default([]),
  video: LocalizedVideo.default({}),
  /** Captions for animation phases, rendered by the UI (the video itself has no text). */
  animationPhases: z
    .array(z.object({ fromSec: z.number().min(0).max(10), toSec: z.number().min(0).max(10), label: Localized }))
    .max(8)
    .default([]),
  sources: z.array(SourceRef).max(20).default([]),
  seo: z.object({ title: Localized.optional(), description: Localized.optional() }).optional(),
});
export type PoseDoc = z.infer<typeof PoseDoc>;

export const STEP_KINDS = ["lesson", "exercise", "pose"] as const;
export const ProgramStep = z.object({
  key: StepKey,
  kind: z.enum(STEP_KINDS),
  title: Localized,
  body: Localized,
  poseId: z.uuid().optional(),
  exerciseId: z.uuid().optional(),
  durationMin: z.number().int().min(1).max(180).optional(),
  video: LocalizedVideo.optional(),
});
export type ProgramStep = z.infer<typeof ProgramStep>;

export const ProgramDoc = z.object({
  title: Localized,
  summary: Localized,
  description: Localized,
  audience: Localized,
  prerequisites: z.array(Localized).max(12).default([]),
  goals: z.array(Localized).max(12).default([]),
  safety: z.array(Localized).max(8).default([]),
  steps: z.array(ProgramStep).max(80).default([]),
});
export type ProgramDoc = z.infer<typeof ProgramDoc>;

export const ExerciseDoc = z.object({
  name: Localized,
  summary: Localized,
  instructions: z.array(Localized).max(10).default([]),
  safety: z.array(Localized).max(8).default([]),
  muscles: z.array(MuscleKey).max(10).default([]),
  sources: z.array(SourceRef).max(10).default([]),
});
export type ExerciseDoc = z.infer<typeof ExerciseDoc>;

export const PageSection = z.object({ heading: Localized, body: Localized });
export const FaqItem = z.object({ q: Localized, a: Localized });

/** Generic page (about, faq, contact, privacy, terms, home texts). */
export const PageDoc = z.object({
  title: Localized,
  intro: Localized.optional(),
  sections: z.array(PageSection).max(40).default([]),
  items: z.array(FaqItem).max(60).default([]),
  /** Free-form localized text blocks addressed by key (used by the home page). */
  blocks: z.record(z.string().regex(/^[a-zA-Z0-9_.-]+$/), Localized).default({}),
  /** Ordered slugs (used by the home page for featured poses). */
  featured: z.array(SlugSchema).max(12).default([]),
  contact: z
    .object({
      email: z.email().nullable().optional(),
      socials: z.array(z.object({ label: z.string().min(1).max(40), url: z.url() })).max(10).default([]),
    })
    .optional(),
  updatedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type PageDoc = z.infer<typeof PageDoc>;

export const DOC_SCHEMAS = {
  pose: PoseDoc,
  program: ProgramDoc,
  exercise: ExerciseDoc,
  page: PageDoc,
} as const;
export type DocType = keyof typeof DOC_SCHEMAS;
export type DocOf<T extends DocType> = z.infer<(typeof DOC_SCHEMAS)[T]>;

export function parseDoc<T extends DocType>(type: T, value: unknown): DocOf<T> {
  return DOC_SCHEMAS[type].parse(value) as DocOf<T>;
}

export function safeParseDoc<T extends DocType>(type: T, value: unknown) {
  return DOC_SCHEMAS[type].safeParse(value);
}
