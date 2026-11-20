import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { ExerciseDoc, PageDoc, PoseDoc, ProgramDoc, type Localized } from "@/lib/content/schema";

export const TAGS = {
  taxonomy: "taxonomy",
  catalog: "catalog",
  programs: "programs",
  exercises: "exercises",
  settings: "settings",
  pose: (slug: string) => `pose:${slug}`,
  program: (slug: string) => `program:${slug}`,
  page: (slug: string) => `page:${slug}`,
  media: "media",
} as const;

export interface Level {
  key: string;
  rank: number;
  label: Localized;
  description: Localized;
}
export interface Category {
  key: string;
  name: Localized;
  description: Localized;
}
export interface Skill {
  key: string;
  name: Localized;
  quickFilter: boolean;
}
export interface SiteSettings {
  levelLabelOverrides: Record<string, Localized>;
  contact: { email: string | null; socials: { label: string; url: string }[] };
}

export interface MediaItem {
  id: string;
  kind: string;
  url: string;
  mime: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  alt: Partial<Localized>;
  position: number;
  checkStatus: string;
  meta: Record<string, unknown>;
}

export interface PoseMedia {
  animation: MediaItem[]; // several encodings of the same clip
  poster: MediaItem | null;
  card: MediaItem | null;
  keyframes: MediaItem[];
}

export interface CatalogPose {
  id: string;
  slug: string;
  name: Localized;
  subtitle: Localized | null;
  sanskrit: string;
  altNames: string[];
  summary: Localized;
  categoryKey: string;
  levelKey: string;
  skillKeys: string[];
  sortWeight: number;
  expertApproved: boolean;
  card: { url: string; width: number | null; height: number | null } | null;
}

export interface PublishedPose extends CatalogPose {
  doc: PoseDoc;
  versionNo: number;
  publishedAt: string;
  media: PoseMedia;
}

export interface PublishedProgram {
  id: string;
  slug: string;
  levelKey: string;
  sortWeight: number;
  expertApproved: boolean;
  doc: ProgramDoc;
  publishedAt: string;
}

export interface PublishedExercise {
  id: string;
  slug: string;
  doc: ExerciseDoc;
  image: MediaItem | null;
}

function mapMedia(row: {
  id: string;
  kind: string;
  url: string;
  mime: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  alt: unknown;
  position: number;
  check_status: string;
  meta: unknown;
}): MediaItem {
  return {
    id: row.id,
    kind: row.kind,
    url: row.url,
    mime: row.mime,
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    alt: (row.alt ?? {}) as Partial<Localized>,
    position: row.position,
    checkStatus: row.check_status,
    meta: (row.meta ?? {}) as Record<string, unknown>,
  };
}

const MEDIA_COLS = "id, document_id, kind, url, mime, width, height, duration_ms, alt, position, check_status, meta";

export async function getTaxonomy() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.taxonomy, TAGS.settings);
  const db = createPublicClient();
  const [levels, categories, skills, settings] = await Promise.all([
    db.from("levels").select("key, rank, label, description").order("position"),
    db.from("categories").select("key, name, description").order("position"),
    db.from("skills").select("key, name, quick_filter").order("position"),
    db.from("site_settings").select("data").eq("id", 1).maybeSingle(),
  ]);
  if (levels.error || categories.error || skills.error) {
    throw new Error("Failed to load taxonomy");
  }
  const data = (settings.data?.data ?? {}) as Partial<SiteSettings>;
  const overrides = data.levelLabelOverrides ?? {};
  return {
    levels: levels.data.map(
      (l): Level => ({
        key: l.key,
        rank: l.rank,
        label: { ...(l.label as Localized), ...(overrides[l.key] ?? {}) },
        description: l.description as Localized,
      }),
    ),
    categories: categories.data.map((c): Category => ({ key: c.key, name: c.name as Localized, description: c.description as Localized })),
    skills: skills.data.map((s): Skill => ({ key: s.key, name: s.name as Localized, quickFilter: s.quick_filter })),
    settings: {
      levelLabelOverrides: overrides,
      contact: { email: data.contact?.email ?? null, socials: data.contact?.socials ?? [] },
    } satisfies SiteSettings,
  };
}

function toCatalogPose(
  row: {
    document_id: string;
    slug: string;
    doc: unknown;
    category_key: string | null;
    level_key: string | null;
    skill_keys: string[];
    sort_weight: number;
    expert_approved: boolean;
  },
  card: MediaItem | null,
): CatalogPose {
  const doc = PoseDoc.parse(row.doc);
  return {
    id: row.document_id,
    slug: row.slug,
    name: doc.name,
    subtitle: doc.subtitle ?? null,
    sanskrit: doc.sanskrit,
    altNames: doc.altNames,
    summary: doc.summary,
    categoryKey: row.category_key ?? "",
    levelKey: row.level_key ?? "",
    skillKeys: row.skill_keys,
    sortWeight: row.sort_weight,
    expertApproved: row.expert_approved,
    card: card ? { url: card.url, width: card.width, height: card.height } : null,
  };
}

export async function getCatalog(): Promise<CatalogPose[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog, TAGS.media);
  const db = createPublicClient();
  const { data, error } = await db
    .from("publications")
    .select("document_id, slug, doc, category_key, level_key, skill_keys, sort_weight, expert_approved")
    .eq("type", "pose");
  if (error) throw new Error(`Failed to load catalog: ${error.message}`);
  const ids = data.map((d) => d.document_id);
  const cards = new Map<string, MediaItem>();
  if (ids.length > 0) {
    const media = await db.from("media_assets").select(MEDIA_COLS).in("document_id", ids).in("kind", ["card", "poster"]);
    if (media.error) throw new Error(`Failed to load media: ${media.error.message}`);
    for (const m of media.data) {
      const prev = cards.get(m.document_id!);
      // prefer the light "card" rendition over the poster
      if (!prev || (m.kind === "card" && prev.kind !== "card")) cards.set(m.document_id!, mapMedia(m));
    }
  }
  return data.map((row) => toCatalogPose(row, cards.get(row.document_id) ?? null));
}

export async function getPose(slug: string): Promise<PublishedPose | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog, TAGS.pose(slug), TAGS.media);
  const db = createPublicClient();
  const { data, error } = await db
    .from("publications")
    .select("document_id, slug, doc, category_key, level_key, skill_keys, sort_weight, expert_approved, version_no, published_at")
    .eq("type", "pose")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to load pose: ${error.message}`);
  if (!data) return null;
  const media = await db.from("media_assets").select(MEDIA_COLS).eq("document_id", data.document_id).order("position");
  if (media.error) throw new Error(`Failed to load media: ${media.error.message}`);
  const items = media.data.map(mapMedia);
  const poseMedia: PoseMedia = {
    animation: items.filter((m) => m.kind === "animation"),
    poster: items.find((m) => m.kind === "poster") ?? null,
    card: items.find((m) => m.kind === "card") ?? null,
    keyframes: items.filter((m) => m.kind === "keyframe").sort((a, b) => a.position - b.position),
  };
  const base = toCatalogPose(data, poseMedia.card ?? poseMedia.poster);
  return {
    ...base,
    doc: PoseDoc.parse(data.doc),
    versionNo: data.version_no,
    publishedAt: data.published_at,
    media: poseMedia,
  };
}

export async function getPrograms(): Promise<PublishedProgram[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.programs);
  const db = createPublicClient();
  const { data, error } = await db
    .from("publications")
    .select("document_id, slug, doc, level_key, sort_weight, expert_approved, published_at")
    .eq("type", "program")
    .order("sort_weight");
  if (error) throw new Error(`Failed to load programs: ${error.message}`);
  return data.map((row) => ({
    id: row.document_id,
    slug: row.slug,
    levelKey: row.level_key ?? "",
    sortWeight: row.sort_weight,
    expertApproved: row.expert_approved,
    doc: ProgramDoc.parse(row.doc),
    publishedAt: row.published_at,
  }));
}

export async function getProgram(slug: string): Promise<PublishedProgram | null> {
  const programs = await getPrograms();
  return programs.find((p) => p.slug === slug) ?? null;
}

/**
 * Data for the dynamic content routes (pose, program, step pages), with a lifetime under 5 minutes ON PURPOSE.
 *
 * On a dynamic route Next.js 16 (Cache Components) renders an expired page by resuming the route's fallback
 * shell, and "use cache" results embedded in that shell at build time (its Resume Data Cache) are reused
 * without checking the global tag manifest (only tags revalidated in the same request are checked). The
 * first visitor after a publish would get build-time data. Entries that expire in under 5 minutes are never
 * embedded in a prerender, so these views are always read from the regular cache, which honours updateTag().
 * Static routes (home, library, about…) re-render fully and keep the long-lived getters. See DECISIONS.md.
 */
const DYNAMIC_ROUTE_LIFE = { stale: 30, revalidate: 60, expire: 240 } as const;

export async function getPoseView(slug: string) {
  "use cache";
  cacheLife(DYNAMIC_ROUTE_LIFE);
  cacheTag(TAGS.pose(slug), TAGS.catalog, TAGS.programs, TAGS.exercises, TAGS.taxonomy, TAGS.settings, TAGS.media);
  const [pose, taxonomy, catalog, exercises, programs] = await Promise.all([getPose(slug), getTaxonomy(), getCatalog(), getExercises(), getPrograms()]);
  return { pose, taxonomy, catalog, exercises, programs };
}

export async function getProgramView(slug: string) {
  "use cache";
  cacheLife(DYNAMIC_ROUTE_LIFE);
  cacheTag(TAGS.programs, TAGS.program(slug), TAGS.catalog, TAGS.exercises, TAGS.taxonomy, TAGS.settings, TAGS.media);
  const [programs, taxonomy, catalog, exercises] = await Promise.all([getPrograms(), getTaxonomy(), getCatalog(), getExercises()]);
  return { program: programs.find((p) => p.slug === slug) ?? null, taxonomy, catalog, exercises };
}

export async function getExercises(): Promise<PublishedExercise[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.exercises, TAGS.media);
  const db = createPublicClient();
  const { data, error } = await db.from("publications").select("document_id, slug, doc").eq("type", "exercise");
  if (error) throw new Error(`Failed to load exercises: ${error.message}`);
  const ids = data.map((d) => d.document_id);
  const images = new Map<string, MediaItem>();
  if (ids.length > 0) {
    const media = await db.from("media_assets").select(MEDIA_COLS).in("document_id", ids).in("kind", ["image", "poster", "card"]);
    if (!media.error) for (const m of media.data) if (!images.has(m.document_id!)) images.set(m.document_id!, mapMedia(m));
  }
  return data.map((row) => ({
    id: row.document_id,
    slug: row.slug,
    doc: ExerciseDoc.parse(row.doc),
    image: images.get(row.document_id) ?? null,
  }));
}

export async function getPage(slug: string): Promise<{ doc: PageDoc; publishedAt: string } | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.page(slug));
  const db = createPublicClient();
  const { data, error } = await db
    .from("publications")
    .select("doc, published_at")
    .eq("type", "page")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to load page: ${error.message}`);
  if (!data) return null;
  return { doc: PageDoc.parse(data.doc), publishedAt: data.published_at };
}
