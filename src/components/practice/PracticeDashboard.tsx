"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMember } from "@/components/member/MemberState";
import { PoseCard, type PoseCardData } from "@/components/pose/PoseCard";
import { Icon } from "@/components/ui/Icon";
import { buttonClass } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { programProgress } from "@/lib/content/step-keys";
import { fmt } from "@/lib/i18n/format";
import {
  addGoal,
  addPracticeEntry,
  deleteGoal,
  deletePracticeEntry,
  listPractice,
  setGoalAchieved,
  type GoalItem,
  type PracticeEntry,
} from "@/app/actions/member";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export interface PracticeProgram {
  id: string;
  slug: string;
  title: string;
  stepKeys: string[];
}

const TABS = ["overview", "favorites", "in-progress", "learned", "programs", "history", "goals"] as const;
type Tab = (typeof TABS)[number];

export function PracticeDashboard({
  locale,
  poses,
  programs,
  dict,
}: {
  locale: string;
  poses: PoseCardData[];
  programs: PracticeProgram[];
  dict: { practice: Dictionary["practice"]; actions: Dictionary["actions"]; programs: Dictionary["programs"]; common: Dictionary["common"]; levelAria: string; auth: { login: string; signup: string } };
}) {
  const member = useMember();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "overview";
  const [data, setData] = useState<{ log: PracticeEntry[]; goals: GoalItem[] } | null>(null);
  const p = dict.practice;

  const reload = useCallback(async () => setData(await listPractice()), []);
  useEffect(() => {
    if (member.status !== "member") return;
    let cancelled = false;
    void listPractice().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [member.status]);

  const byId = useMemo(() => new Map(poses.map((x) => [x.id, x])), [poses]);
  const favLabels = { add: dict.actions.favorite, remove: dict.actions.removeFavorite, added: dict.actions.favorited };

  if (member.status === "loading") {
    return <div className="mt-8 grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>;
  }
  if (member.status === "guest") {
    return (
      <div className="mt-10 rounded-[var(--radius-lg)] border border-line bg-surface p-8 text-center">
        <h2 className="text-2xl">{p.signInTitle}</h2>
        <p className="mt-2 text-muted">{dict.actions.signInToSaveText}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={`/${locale}/login?next=${encodeURIComponent(pathname)}`} className={buttonClass("dark")}>
            {dict.auth.login}
          </Link>
          <Link href={`/${locale}/sign-up?next=${encodeURIComponent(pathname)}`} className={buttonClass("secondary")}>
            {dict.auth.signup}
          </Link>
        </div>
      </div>
    );
  }

  const favorites = member.state.favorites.map((id) => byId.get(id)).filter((x): x is PoseCardData => !!x);
  const withStatus = (status: "in_progress" | "learned") =>
    Object.entries(member.state.progress)
      .filter(([, v]) => v.status === status)
      .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))
      .map(([id, v]) => ({ pose: byId.get(id), updatedAt: v.updatedAt }))
      .filter((x): x is { pose: PoseCardData; updatedAt: string } => !!x.pose);
  const inProgress = withStatus("in_progress");
  const learned = withStatus("learned");
  const programRows = programs.map((pr) => ({ ...pr, progress: programProgress(pr.stepKeys, member.completedSteps(pr.id)) }));
  const started = programRows.filter((r) => r.progress.completed > 0);
  const stepsDone = programRows.reduce((sum, r) => sum + r.progress.completed, 0);
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  const setTab = (t: Tab) => router.replace(`${pathname}${t === "overview" ? "" : `?tab=${t}`}`, { scroll: false });
  const labels: Record<Tab, string> = {
    overview: p.overview,
    favorites: p.favorites,
    "in-progress": p.inProgress,
    learned: p.learned,
    programs: p.programs,
    history: p.history,
    goals: p.goals,
  };

  const grid = (items: { pose: PoseCardData; updatedAt?: string }[], empty: string) =>
    items.length === 0 ? (
      <p className="rounded-[var(--radius-md)] border border-dashed border-line-strong p-8 text-center text-muted">{empty}</p>
    ) : (
      <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {items.map(({ pose, updatedAt }) => (
          <li key={pose.id}>
            <PoseCard pose={pose} href={`/${locale}/poses/${pose.slug}`} favoriteLabels={favLabels} levelAria={fmt(dict.levelAria, { level: pose.levelLabel })} />
            {updatedAt ? <p className="mt-1.5 px-1 text-xs text-muted">{fmt(p.updated, { d: date(updatedAt) })}</p> : null}
          </li>
        ))}
      </ul>
    );

  const programList = (rows: typeof programRows) =>
    rows.length === 0 ? (
      <p className="rounded-[var(--radius-md)] border border-dashed border-line-strong p-8 text-center text-muted">{p.emptyPrograms}</p>
    ) : (
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-[var(--radius-md)] border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/${locale}/programs/${r.slug}`} className="font-semibold hover:text-brand">
                {r.title}
              </Link>
              <span className="text-sm text-muted">{fmt(dict.programs.progress, { done: r.progress.completed, total: r.progress.total })}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-brand" style={{ width: `${r.progress.percent}%` }} />
            </div>
            {r.progress.nextKey ? (
              <Link href={`/${locale}/programs/${r.slug}/steps/${r.progress.nextKey}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                {fmt(dict.programs.continueFrom, { n: r.stepKeys.indexOf(r.progress.nextKey) + 1 })}
                <Icon name="arrowRight" size={14} />
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    );

  return (
    <div className="mt-8">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label={p.title} className="flex w-max gap-1 rounded-full border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors ${tab === t ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
              data-testid={`tab-${t}`}
            >
              {labels[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8" role="tabpanel">
        {tab === "overview" ? (
          <div className="space-y-10">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { n: favorites.length, label: p.stats.favorites, tab: "favorites" as Tab },
                { n: inProgress.length, label: p.stats.inProgress, tab: "in-progress" as Tab },
                { n: learned.length, label: p.stats.learned, tab: "learned" as Tab },
                { n: stepsDone, label: p.stats.steps, tab: "programs" as Tab },
              ].map((s) => (
                <li key={s.label}>
                  <button type="button" onClick={() => setTab(s.tab)} className="w-full rounded-[var(--radius-lg)] border border-line bg-surface p-5 text-left hover:border-brand">
                    <span className="block font-serif text-4xl">{s.n}</span>
                    <span className="mt-1 block text-sm text-muted">{s.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <section>
              <h2 className="mb-4 text-2xl">{p.programs}</h2>
              {programList(started.length > 0 ? started : programRows.slice(0, 2))}
            </section>
            <section>
              <h2 className="mb-4 text-2xl">{p.inProgress}</h2>
              {grid(inProgress.slice(0, 4), p.emptyInProgress)}
            </section>
          </div>
        ) : null}
        {tab === "favorites" ? grid(favorites.map((pose) => ({ pose })), p.emptyFavorites) : null}
        {tab === "in-progress" ? grid(inProgress, p.emptyInProgress) : null}
        {tab === "learned" ? grid(learned, p.emptyLearned) : null}
        {tab === "programs" ? programList(programRows) : null}
        {tab === "history" ? (
          <History
            entries={data?.log ?? null}
            poses={poses}
            labels={p}
            common={dict.common}
            date={date}
            onAdd={async (entry) => {
              const res = await addPracticeEntry(entry);
              if (res.ok) {
                toast(dict.common.saved, "success");
                await reload();
              } else toast(dict.actions.saveError, "error");
            }}
            onDelete={async (id) => {
              const res = await deletePracticeEntry(id);
              if (res.ok) await reload();
              else toast(dict.actions.saveError, "error");
            }}
          />
        ) : null}
        {tab === "goals" ? (
          <Goals
            goals={data?.goals ?? null}
            poses={poses}
            labels={p}
            common={dict.common}
            date={date}
            onAdd={async (g) => {
              const res = await addGoal(g);
              if (res.ok) await reload();
              else toast(dict.actions.saveError, "error");
            }}
            onToggle={async (id, achieved) => {
              const res = await setGoalAchieved(id, achieved);
              if (res.ok) await reload();
              else toast(dict.actions.saveError, "error");
            }}
            onDelete={async (id) => {
              const res = await deleteGoal(id);
              if (res.ok) await reload();
              else toast(dict.actions.saveError, "error");
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

const field = "mt-1 h-11 w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 text-base";

function PoseSelect({ poses, value, onChange, none }: { poses: PoseCardData[]; value: string; onChange: (v: string) => void; none: string }) {
  return (
    <select className={field} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{none}</option>
      {[...poses].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

function History({
  entries,
  poses,
  labels,
  common,
  date,
  onAdd,
  onDelete,
}: {
  entries: PracticeEntry[] | null;
  poses: PoseCardData[];
  labels: Dictionary["practice"];
  common: Dictionary["common"];
  date: (iso: string) => string;
  onAdd: (e: { practicedOn: string; poseId: string | null; durationMin: number | null; note: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [practicedOn, setDate] = useState(today);
  const [poseId, setPose] = useState("");
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const byId = new Map(poses.map((p) => [p.id, p.name]));
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <form
        className="space-y-3 rounded-[var(--radius-lg)] border border-line bg-surface p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await onAdd({ practicedOn, poseId: poseId || null, durationMin: duration ? Number(duration) : null, note: note || null });
          setNote("");
          setDuration("");
          setBusy(false);
        }}
        data-testid="practice-form"
      >
        <h2 className="text-xl">{labels.addEntry}</h2>
        <label className="block text-sm font-semibold">
          {labels.date}
          <input type="date" className={field} value={practicedOn} max={today} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="block text-sm font-semibold">
          {labels.pose}
          <PoseSelect poses={poses} value={poseId} onChange={setPose} none={labels.none} />
        </label>
        <label className="block text-sm font-semibold">
          {labels.duration}
          <input type="number" min={1} max={600} inputMode="numeric" className={field} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold">
          {labels.note}
          <textarea className={`${field} h-24 py-2`} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="submit" disabled={busy} className={buttonClass("dark", "md", "w-full")}>
          {labels.addEntry}
        </button>
      </form>
      <div>
        {entries === null ? (
          <div className="skeleton h-32" />
        ) : entries.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-line-strong p-8 text-center text-muted">{labels.emptyHistory}</p>
        ) : (
          <ul className="space-y-3" data-testid="practice-list">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4">
                <div>
                  <p className="font-semibold">
                    {date(e.practicedOn)}
                    {e.poseId ? ` · ${byId.get(e.poseId) ?? ""}` : ""}
                    {e.durationMin ? ` · ${e.durationMin} ${common.min}` : ""}
                  </p>
                  {e.note ? <p className="mt-1 whitespace-pre-line text-sm text-muted">{e.note}</p> : null}
                </div>
                <button type="button" onClick={() => onDelete(e.id)} className="rounded-full p-2 text-muted hover:text-danger" aria-label={common.delete}>
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Goals({
  goals,
  poses,
  labels,
  common,
  date,
  onAdd,
  onToggle,
  onDelete,
}: {
  goals: GoalItem[] | null;
  poses: PoseCardData[];
  labels: Dictionary["practice"];
  common: Dictionary["common"];
  date: (iso: string) => string;
  onAdd: (g: { title: string; poseId: string | null; targetDate: string | null }) => Promise<void>;
  onToggle: (id: string, achieved: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [poseId, setPose] = useState("");
  const [target, setTarget] = useState("");
  const byId = new Map(poses.map((p) => [p.id, p]));
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <form
        className="space-y-3 rounded-[var(--radius-lg)] border border-line bg-surface p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          await onAdd({ title: title.trim(), poseId: poseId || null, targetDate: target || null });
          setTitle("");
          setTarget("");
        }}
        data-testid="goal-form"
      >
        <h2 className="text-xl">{labels.addGoal}</h2>
        <label className="block text-sm font-semibold">
          {labels.goalTitle}
          <input className={field} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="block text-sm font-semibold">
          {labels.pose}
          <PoseSelect poses={poses} value={poseId} onChange={setPose} none={labels.none} />
        </label>
        <label className="block text-sm font-semibold">
          {labels.targetDate}
          <input type="date" className={field} value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <button type="submit" className={buttonClass("dark", "md", "w-full")}>
          {labels.addGoal}
        </button>
      </form>
      <div>
        {goals === null ? (
          <div className="skeleton h-32" />
        ) : goals.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-line-strong p-8 text-center text-muted">{labels.emptyGoals}</p>
        ) : (
          <ul className="space-y-3" data-testid="goal-list">
            {goals.map((g) => (
              <li key={g.id} className="flex items-start gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4">
                <button
                  type="button"
                  onClick={() => onToggle(g.id, !g.achievedAt)}
                  aria-pressed={!!g.achievedAt}
                  aria-label={labels.markAchieved}
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${g.achievedAt ? "border-success bg-success text-white" : "border-line-strong"}`}
                >
                  {g.achievedAt ? <Icon name="check" size={14} /> : null}
                </button>
                <div className="flex-1">
                  <p className={`font-semibold ${g.achievedAt ? "text-muted line-through" : ""}`}>{g.title}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {g.poseId && byId.get(g.poseId) ? byId.get(g.poseId)!.name : null}
                    {g.targetDate ? ` · ${labels.targetDate}: ${date(g.targetDate)}` : null}
                    {g.achievedAt ? ` · ${labels.achieved}: ${date(g.achievedAt)}` : null}
                  </p>
                </div>
                <button type="button" onClick={() => onDelete(g.id)} className="rounded-full p-2 text-muted hover:text-danger" aria-label={common.delete}>
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
