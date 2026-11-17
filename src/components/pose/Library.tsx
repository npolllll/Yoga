"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { buildIndex, search } from "@/lib/search/normalize";
import { fmt } from "@/lib/i18n/format";
import { PoseCard, type PoseCardData } from "./PoseCard";

export interface LibraryPose extends PoseCardData {
  names: string[]; // every searchable name (ru, en, sanskrit, alternatives)
  levelKey: string;
  categoryKey: string;
  skillKeys: string[];
  sortWeight: number;
}

export interface LibraryLabels {
  searchPlaceholder: string;
  searchLabel: string;
  filters: string;
  level: string;
  type: string;
  skills: string;
  reset: string;
  apply: string;
  found: string;
  sortBy: string;
  sort: { recommended: string; name: string; level: string };
  empty: string;
  loadMore: string;
  activeFilters: string;
  removeFilter: string;
  close: string;
  favorite: { add: string; remove: string; added: string };
  levelAria: string;
}

type Option = { key: string; label: string };
type SortKey = "recommended" | "name" | "level";
const PAGE = 12;

function readList(params: URLSearchParams, key: string): string[] {
  return (params.get(key) ?? "").split(",").filter(Boolean);
}

export function Library({
  locale,
  poses,
  levels,
  categories,
  skills,
  quickSkills,
  labels,
}: {
  locale: string;
  poses: LibraryPose[];
  levels: Option[];
  categories: Option[];
  skills: Option[];
  quickSkills: string[];
  labels: LibraryLabels;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = {
    level: readList(params, "level"),
    type: readList(params, "type"),
    skills: readList(params, "skills"),
  };
  const sort = (["recommended", "name", "level"].includes(params.get("sort") ?? "") ? params.get("sort") : "recommended") as SortKey;
  const urlQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  // Follow the URL (back/forward, language switch) — adjusted during render instead of in an effect.
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (syncedQuery !== urlQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }
  useEffect(() => {
    if (params.get("focus") === "search") searchRef.current?.focus();
  }, [params]);

  const update = (patch: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      const value = Array.isArray(v) ? v.join(",") : v;
      if (value) next.set(k, value);
      else next.delete(k);
    }
    next.delete("focus");
    setLimit(PAGE);
    const qs = next.toString();
    startTransition(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  };

  // Debounce writing the search query into the URL (keeps it shareable and preserved across RU/EN).
  useEffect(() => {
    if (query === urlQuery) return;
    const id = window.setTimeout(() => update({ q: query.trim() || null }), 250);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const index = useMemo(() => buildIndex(poses.map((p) => ({ id: p.id, names: p.names }))), [poses]);
  const rank = useMemo(() => Object.fromEntries(levels.map((l, i) => [l.key, i])), [levels]);

  const results = useMemo(() => {
    const matched = search(index, query);
    const list = poses.filter(
      (p) =>
        matched.has(p.id) &&
        (selected.level.length === 0 || selected.level.includes(p.levelKey)) &&
        (selected.type.length === 0 || selected.type.includes(p.categoryKey)) &&
        selected.skills.every((s) => p.skillKeys.includes(s)),
    );
    const collator = new Intl.Collator(locale);
    return list.sort((a, b) => {
      if (sort === "name") return collator.compare(a.name, b.name);
      if (sort === "level") return (rank[a.levelKey] ?? 9) - (rank[b.levelKey] ?? 9) || collator.compare(a.name, b.name);
      return a.sortWeight - b.sortWeight || collator.compare(a.name, b.name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, poses, query, params, sort, rank, locale]);

  const toggle = (key: "level" | "type" | "skills", value: string) => {
    const current = selected[key];
    update({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
  };

  const activeChips = [
    ...selected.level.map((k) => ({ group: "level" as const, key: k, label: levels.find((l) => l.key === k)?.label ?? k })),
    ...selected.type.map((k) => ({ group: "type" as const, key: k, label: categories.find((c) => c.key === k)?.label ?? k })),
    ...selected.skills.map((k) => ({ group: "skills" as const, key: k, label: skills.find((s) => s.key === k)?.label ?? k })),
  ];
  const activeCount = activeChips.length;

  const groups = (
    <>
      <FilterGroup title={labels.level} options={levels} selected={selected.level} onToggle={(v) => toggle("level", v)} name="level" />
      <FilterGroup title={labels.type} options={categories} selected={selected.type} onToggle={(v) => toggle("type", v)} name="type" />
      <FilterGroup title={labels.skills} options={skills} selected={selected.skills} onToggle={(v) => toggle("skills", v)} name="skills" />
    </>
  );

  return (
    <div>
      <div className="sticky top-[var(--header-h)] z-20 -mx-4 bg-bg/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <label className="relative block">
          <span className="sr-only">{labels.searchLabel}</span>
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            enterKeyHint="search"
            autoComplete="off"
            data-testid="library-search"
            className="h-12 w-full rounded-full border border-line-strong bg-surface pl-12 pr-4 text-base outline-none transition-colors placeholder:text-muted focus:border-brand"
          />
        </label>
        <div className="mt-3 flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold"
            aria-haspopup="dialog"
            data-testid="open-filters"
          >
            <Icon name="filter" size={18} />
            {labels.filters}
            {activeCount > 0 ? <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">{activeCount}</span> : null}
          </button>
          <SortSelect sort={sort} labels={labels} onChange={(s) => update({ sort: s === "recommended" ? null : s })} />
        </div>
      </div>

      <div className="mt-6 hidden gap-8 lg:grid lg:grid-cols-3" data-testid="desktop-filters">
        {groups}
      </div>
      <div className="mt-4 hidden flex-wrap gap-2 lg:flex" aria-label={labels.skills}>
        {quickSkills.map((key) => {
          const s = skills.find((x) => x.key === key);
          if (!s) return null;
          const on = selected.skills.includes(key);
          return (
            <label key={key} className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${on ? "border-brand bg-surface-2 text-brand" : "border-line bg-surface text-muted hover:text-ink"}`}>
              <input type="checkbox" className="accent-[var(--c-primary-strong)]" checked={on} onChange={() => toggle("skills", key)} />
              {s.label}
            </label>
          );
        })}
      </div>

      {activeCount > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={labels.activeFilters}>
          {activeChips.map((chip) => (
            <button
              key={`${chip.group}-${chip.key}`}
              type="button"
              onClick={() => toggle(chip.group, chip.key)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-lilac-soft px-3 text-sm font-semibold"
              aria-label={fmt(labels.removeFilter, { name: chip.label })}
            >
              {chip.label}
              <Icon name="close" size={14} />
            </button>
          ))}
          <button type="button" onClick={() => { setQuery(""); update({ level: null, type: null, skills: null, q: null }); }} className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
            {labels.reset}
          </button>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="font-semibold" aria-live="polite" data-testid="result-count">
          {fmt(labels.found, { n: results.length })}
        </p>
        <div className="hidden items-center gap-3 lg:flex">
          {activeCount > 0 || query ? (
            <button type="button" onClick={() => { setQuery(""); update({ level: null, type: null, skills: null, q: null }); }} className="text-sm font-semibold text-brand hover:underline">
              {labels.reset}
            </button>
          ) : null}
          <SortSelect sort={sort} labels={labels} onChange={(s) => update({ sort: s === "recommended" ? null : s })} />
        </div>
      </div>

      {results.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface p-10 text-center">
          <p className="text-muted">{labels.empty}</p>
          <button type="button" onClick={() => { setQuery(""); update({ level: null, type: null, skills: null, q: null }); }} className="mt-4 font-semibold text-brand hover:underline">
            {labels.reset}
          </button>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4" data-testid="pose-grid">
          {results.slice(0, limit).map((p, i) => (
            <li key={p.id} className="animate-rise" data-slug={p.slug}>
              <PoseCard pose={p} href={`/${locale}/poses/${p.slug}`} priority={i < 4} favoriteLabels={labels.favorite} levelAria={fmt(labels.levelAria, { level: p.levelLabel })} />
            </li>
          ))}
        </ul>
      )}
      {results.length > limit ? (
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-6 font-semibold hover:border-brand">
            {labels.loadMore}
          </button>
        </div>
      ) : null}

      {sheetOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={labels.filters}>
          <div className="absolute inset-0 bg-ink/30" onClick={() => setSheetOpen(false)} />
          <div className="animate-rise absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-[var(--radius-lg)] bg-surface shadow-lift">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-xl">{labels.filters}</h2>
              <button type="button" onClick={() => setSheetOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2" aria-label={labels.close} autoFocus>
                <Icon name="close" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">{groups}</div>
            <div className="grid grid-cols-2 gap-3 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button type="button" onClick={() => update({ level: null, type: null, skills: null })} className="h-12 rounded-full border border-line-strong font-semibold">
                {labels.reset}
              </button>
              <button type="button" onClick={() => setSheetOpen(false)} className="h-12 rounded-full bg-brand font-semibold text-white" data-testid="apply-filters">
                {labels.apply} ({results.length})
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
  name,
}: {
  title: string;
  options: Option[];
  selected: string[];
  onToggle: (key: string) => void;
  name: string;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.key);
          return (
            <label
              key={o.key}
              className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${
                on ? "border-brand bg-brand text-white" : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <input type="checkbox" className="sr-only" name={name} value={o.key} checked={on} onChange={() => onToggle(o.key)} />
              {on ? <Icon name="check" size={14} /> : null}
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function SortSelect({ sort, labels, onChange }: { sort: SortKey; labels: LibraryLabels; onChange: (s: SortKey) => void }) {
  return (
    <label className="ml-auto inline-flex items-center gap-2 text-sm lg:ml-0">
      <span className="text-muted">{labels.sortBy}</span>
      <select
        value={sort}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="h-10 rounded-full border border-line-strong bg-surface px-3 font-semibold"
        data-testid="sort-select"
      >
        <option value="recommended">{labels.sort.recommended}</option>
        <option value="name">{labels.sort.name}</option>
        <option value="level">{labels.sort.level}</option>
      </select>
    </label>
  );
}
