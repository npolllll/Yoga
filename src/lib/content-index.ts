/**
 * Published-content index for the Proxy: which pose/program slugs and program step keys exist.
 *
 * Why: content pages stream their body after the static shell (see getPoseView/getProgramView), so a page that
 * calls notFound() can no longer change the HTTP status. Next.js recommends checking slugs in Proxy before
 * streaming starts; this module answers that check without a database round trip for known URLs.
 *
 * - Positive answers are cached for INDEX_TTL_MS. A miss refetches the index (at most once per MIN_REFRESH_MS),
 *   so newly published content is reachable immediately.
 * - Publishing/unpublishing calls invalidateContentIndex(); in a single-process server (next start) the Proxy
 *   sees that at once (shared via globalThis). On multi-instance hosting (Vercel) an unpublished URL keeps
 *   rendering the not-found page with noindex for at most INDEX_TTL_MS before it answers 404.
 * - If the index cannot be loaded, the check is skipped (the page itself still renders the 404 + noindex).
 */
const INDEX_TTL_MS = 30_000;
const MIN_REFRESH_MS = 2_000;

type ContentIndex = { at: number; poses: Set<string>; programs: Map<string, Set<string>> };
type Store = { index?: ContentIndex; loading?: Promise<ContentIndex | null>; lastRefresh: number };

const KEY = "__balanceContentIndex";
function store(): Store {
  const g = globalThis as unknown as Record<string, Store | undefined>;
  return (g[KEY] ??= { lastRefresh: 0 });
}

export function invalidateContentIndex() {
  const s = store();
  s.index = undefined;
  s.lastRefresh = 0;
}

async function load(): Promise<ContentIndex | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/publications?select=type,slug,steps:doc->steps&type=in.(pose,program)`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { type: string; slug: string; steps: { key: string }[] | null }[];
    const poses = new Set<string>();
    const programs = new Map<string, Set<string>>();
    for (const r of rows) {
      if (r.type === "pose") poses.add(r.slug);
      else programs.set(r.slug, new Set((r.steps ?? []).map((s) => s.key)));
    }
    return { at: Date.now(), poses, programs };
  } catch {
    return null;
  }
}

async function getIndex(force: boolean): Promise<ContentIndex | null> {
  const s = store();
  const now = Date.now();
  const fresh = s.index && now - s.index.at < INDEX_TTL_MS;
  if (fresh && !(force && now - s.lastRefresh >= MIN_REFRESH_MS)) return s.index!;
  if (!s.loading) {
    s.lastRefresh = now;
    s.loading = load().then((idx) => {
      if (idx) s.index = idx;
      s.loading = undefined;
      return idx ?? s.index ?? null;
    });
  }
  return s.loading;
}

/** `false` only when the URL is a content page that certainly does not exist; `true` otherwise. */
export async function contentPathExists(segments: string[]): Promise<boolean> {
  // segments: [locale, section, slug, ("steps", key)?]
  const [, section, slug, sub, key] = segments;
  const check = (idx: ContentIndex) => {
    if (section === "poses") return idx.poses.has(slug);
    const steps = idx.programs.get(slug);
    if (!steps) return false;
    return sub === undefined ? true : steps.has(key);
  };
  const cached = await getIndex(false);
  if (!cached) return true;
  if (check(cached)) return true;
  const refreshed = await getIndex(true);
  return !refreshed || check(refreshed);
}

/** Content URLs checked by the Proxy: /{locale}/poses/{slug}, /{locale}/programs/{slug}[/steps/{key}]. */
export function isContentPath(segments: string[]): boolean {
  if (segments[1] === "poses") return segments.length === 3;
  if (segments[1] === "programs") return segments.length === 3 || (segments.length === 5 && segments[3] === "steps");
  return false;
}
