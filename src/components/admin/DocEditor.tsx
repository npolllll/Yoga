"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ControlLabels, FieldEditor, ListControls, LocInput, input, type Option } from "./fields";
import { exerciseFields, pageFields, poseFields, programFields, type SpecOptions } from "./specs";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { issuesFor } from "@/lib/content/issues";
import { duplicateItem, moveItem, newKey } from "@/lib/content/step-keys";
import type { DocType } from "@/lib/content/schema";
import type { Issue } from "@/lib/content/validate";
import {
  addReviewComment,
  deleteDocument,
  duplicateDocument,
  publishDocument,
  restoreVersion,
  saveDocument,
  setReviewStatus,
  unpublishDocument,
} from "@/app/actions/admin";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface EditorDoc {
  id: string;
  type: DocType;
  slug: string;
  revision: number;
  reviewStatus: "draft" | "editorial_review" | "expert_review" | "approved";
  draft: any;
  category_key: string | null;
  level_key: string | null;
  skill_keys: string[];
  sort_weight: number;
  published: null | { versionNo: number; sourceRevision: number; expertApproved: boolean; publishedAt: string };
}

export interface EditorContext {
  locale: string;
  roles: string[];
  /** Field specs are built on the client (they contain functions, which cannot cross the server boundary). */
  specOptions: SpecOptions;
  categories: Option[];
  levels: Option[];
  skills: Option[];
  poses: Option[]; // id -> label (program steps)
  exercises: Option[]; // id -> label
  completionCounts: Record<string, number>;
  versions: { versionNo: number; kind: string; createdAt: string; note: string | null }[];
  reviews: { id: string; kind: string; decision: string; comment: string | null; createdAt: string; revision: number }[];
  labels: Record<string, string>;
  statusLabels: Record<string, string>;
}

function sanitize(type: DocType, draft: any) {
  const d = structuredClone(draft);
  if (type === "page" && d.contact) d.contact.email = d.contact.email ? d.contact.email : null;
  return d;
}

export function DocEditor({ doc, ctx }: { doc: EditorDoc; ctx: EditorContext }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<any>(doc.draft);
  const [meta, setMeta] = useState({ slug: doc.slug, category_key: doc.category_key, level_key: doc.level_key, skill_keys: doc.skill_keys, sort_weight: doc.sort_weight });
  const [revision, setRevision] = useState(doc.revision);
  const [dirty, setDirty] = useState(false);
  const [json, setJson] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<Issue[] | null>(null);
  const [comment, setComment] = useState("");
  const L = ctx.labels;
  const fields = useMemo(
    () =>
      doc.type === "pose"
        ? poseFields(ctx.specOptions)
        : doc.type === "program"
          ? programFields()
          : doc.type === "exercise"
            ? exerciseFields(ctx.specOptions)
            : pageFields(ctx.specOptions, doc.slug),
    [doc.type, doc.slug, ctx.specOptions],
  );
  const canEdit = ctx.roles.includes("editor") || ctx.roles.includes("owner");
  const canReview = ctx.roles.includes("reviewer");
  const issues = useMemo(() => serverIssues ?? issuesFor(doc.type, sanitize(doc.type, draft), meta), [draft, meta, doc.type, serverIssues]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const pubState = !doc.published ? "none" : doc.published.sourceRevision === revision && !dirty ? "current" : "changed";

  const update = (patch: any) => {
    setDraft((d: any) => ({ ...d, ...patch }));
    setDirty(true);
    setServerIssues(null);
  };

  const save = () =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const res = await saveDocument({ id: doc.id, type: doc.type, revision, draft: sanitize(doc.type, draft), meta });
        if (!res.ok) {
          toast(res.error === "conflict" ? L.conflict : `${L.error}: ${res.error}`, "error");
          if (res.issues) setServerIssues(res.issues);
          return resolve(false);
        }
        setRevision(res.revision);
        setDirty(false);
        toast(L.savedDraft, "success");
        router.refresh();
        resolve(true);
      }),
    );

  const act = (fn: () => Promise<{ ok: boolean; error?: string; issues?: Issue[] }>, okText: string) =>
    start(async () => {
      if (dirty && !(await save())) return;
      const res = await fn();
      if (!res.ok) {
        if (res.issues) setServerIssues(res.issues);
        toast(`${L.error}: ${res.error}`, "error");
        return;
      }
      toast(okText, "success");
      router.refresh();
    });

  const previewBase = `/${ctx.locale}/admin/preview/${doc.id}`;

  return (
    <ControlLabels value={{ up: L.moveUp, down: L.moveDown, duplicate: L.duplicate, remove: L.delete }}>
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]" data-testid="doc-editor">
      <div className="min-w-0 space-y-6">
        <section className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-surface p-4 sm:grid-cols-2">
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-muted">{L.slug}</span>
            <input className={`${input} mt-1.5 font-mono`} value={meta.slug} onChange={(e) => (setMeta({ ...meta, slug: e.target.value }), setDirty(true))} disabled={!canEdit} />
          </label>
          {doc.type === "pose" || doc.type === "program" ? (
            <label className="block">
              <span className="block text-xs font-bold uppercase tracking-wide text-muted">{L.level}</span>
              <select className={`${input} mt-1.5`} value={meta.level_key ?? ""} onChange={(e) => (setMeta({ ...meta, level_key: e.target.value || null }), setDirty(true))} disabled={!canEdit}>
                <option value="">—</option>
                {ctx.levels.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {doc.type === "pose" ? (
            <label className="block">
              <span className="block text-xs font-bold uppercase tracking-wide text-muted">{L.category}</span>
              <select className={`${input} mt-1.5`} value={meta.category_key ?? ""} onChange={(e) => (setMeta({ ...meta, category_key: e.target.value || null }), setDirty(true))} disabled={!canEdit}>
                <option value="">—</option>
                {ctx.categories.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-muted">{L.sortWeight}</span>
            <input className={`${input} mt-1.5`} type="number" value={meta.sort_weight} onChange={(e) => (setMeta({ ...meta, sort_weight: Number(e.target.value) || 0 }), setDirty(true))} disabled={!canEdit} />
          </label>
          {doc.type === "pose" || doc.type === "exercise" ? (
            <div className="sm:col-span-2">
              <FieldEditor field={{ k: "skills", t: "multi", label: L.skills, options: ctx.skills }} value={meta.skill_keys} onChange={(v) => (setMeta({ ...meta, skill_keys: v }), setDirty(true))} />
            </div>
          ) : null}
        </section>

        {json === null ? (
          <fieldset disabled={!canEdit} className="space-y-6 rounded-[var(--radius-md)] border border-line bg-surface p-4">
            {fields.map((f) => (
              <FieldEditor key={f.k} field={f} value={draft[f.k]} onChange={(v) => update({ [f.k]: v })} />
            ))}
            {doc.type === "program" ? (
              <ProgramSteps steps={draft.steps ?? []} onChange={(steps) => update({ steps })} ctx={ctx} />
            ) : null}
          </fieldset>
        ) : (
          <div className="rounded-[var(--radius-md)] border border-line bg-surface p-4">
            <p className="text-sm text-muted">{L.jsonHint}</p>
            <textarea className={`${input} mt-2 min-h-[60vh] font-mono text-xs`} value={json} onChange={(e) => setJson(e.target.value)} disabled={!canEdit} />
            <button
              type="button"
              className="mt-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
              onClick={() => {
                try {
                  update(JSON.parse(json));
                  setJson(null);
                } catch {
                  toast("JSON", "error");
                }
              }}
            >
              OK
            </button>
          </div>
        )}
        <button type="button" className="text-sm font-semibold text-muted underline" onClick={() => setJson(json === null ? JSON.stringify(draft, null, 2) : null)}>
          {json === null ? "JSON" : L.cancel}
        </button>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-[calc(var(--header-h)+16px)] xl:self-start">
        <section className="space-y-3 rounded-[var(--radius-md)] border border-line bg-surface p-4">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-lilac-soft px-2.5 py-1" data-testid="review-status">{ctx.statusLabels[doc.reviewStatus]}</span>
            <span className={`rounded-full px-2.5 py-1 ${pubState === "none" ? "bg-surface-2" : pubState === "current" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`} data-testid="publish-status">
              {pubState === "none" ? L.notPublished : pubState === "current" ? L.published : L.publishedChanged}
            </span>
            {doc.published ? <span className="rounded-full bg-surface-2 px-2.5 py-1">{doc.published.expertApproved ? L.expertApproved : L.notExpertApproved}</span> : null}
          </div>
          {canEdit ? (
            <div className="grid gap-2">
              <button type="button" disabled={pending || !dirty} onClick={() => void save()} className="h-10 rounded-full bg-ink font-semibold text-white disabled:opacity-40" data-testid="save-draft">
                {L.saveDraft}
              </button>
              <button
                type="button"
                disabled={pending || errors.length > 0}
                onClick={() => act(() => publishDocument(doc.id), L.published)}
                className="h-10 rounded-full bg-brand font-semibold text-white disabled:opacity-40"
                data-testid="publish"
              >
                {L.publish}
              </button>
              {doc.published ? (
                <button type="button" disabled={pending} onClick={() => act(() => unpublishDocument(doc.id), L.notPublished)} className="h-9 rounded-full border border-line-strong text-sm font-semibold">
                  {L.unpublish}
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
            <a href={`/ru/admin/preview/${doc.id}`} target="_blank" className="rounded-full border border-line px-2 py-2 hover:border-brand">
              RU
            </a>
            <a href={`/en/admin/preview/${doc.id}`} target="_blank" className="rounded-full border border-line px-2 py-2 hover:border-brand">
              EN
            </a>
            <a href={`${previewBase}/both`} target="_blank" className="rounded-full border border-line px-2 py-2 hover:border-brand" data-testid="preview-both">
              RU | EN
            </a>
          </div>
          {dirty ? <p className="text-xs text-warning">● {L.saveDraft}</p> : null}
        </section>

        <section className="rounded-[var(--radius-md)] border border-line bg-surface p-4" data-testid="issues">
          <h2 className="font-sans text-sm font-bold">{L.issues}</h2>
          {issues.length === 0 ? (
            <p className="mt-2 text-sm text-success">{L.noIssues}</p>
          ) : (
            <ul className="mt-2 max-h-56 space-y-1 overflow-auto text-xs">
              {errors.map((i, n) => (
                <li key={`e${n}`} className="text-danger">
                  ✕ {i.field}
                  {i.locale ? ` [${i.locale}]` : ""} — {i.code}
                </li>
              ))}
              {warnings.map((i, n) => (
                <li key={`w${n}`} className="text-warning">
                  ! {i.field}
                  {i.locale ? ` [${i.locale}]` : ""} — {i.code}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2 rounded-[var(--radius-md)] border border-line bg-surface p-4">
          <h2 className="font-sans text-sm font-bold">{L.reviews}</h2>
          <div className="grid gap-2">
            {canEdit && doc.reviewStatus === "draft" ? (
              <button type="button" disabled={pending} className="h-9 rounded-full border border-line-strong text-sm font-semibold" onClick={() => act(() => setReviewStatus(doc.id, "editorial_review"), ctx.statusLabels.editorial_review)} data-testid="submit-editorial">
                {L.submitEditorial}
              </button>
            ) : null}
            {canEdit && doc.reviewStatus === "editorial_review" ? (
              <button type="button" disabled={pending} className="h-9 rounded-full border border-line-strong text-sm font-semibold" onClick={() => act(() => setReviewStatus(doc.id, "expert_review", comment), ctx.statusLabels.expert_review)} data-testid="submit-expert">
                {L.submitExpert}
              </button>
            ) : null}
            {canReview && doc.reviewStatus === "expert_review" ? (
              <>
                <button type="button" disabled={pending} className="h-9 rounded-full bg-success text-sm font-semibold text-white" onClick={() => act(() => setReviewStatus(doc.id, "approved", comment), ctx.statusLabels.approved)} data-testid="approve">
                  {L.approve}
                </button>
                <button type="button" disabled={pending} className="h-9 rounded-full border border-line-strong text-sm font-semibold" onClick={() => act(() => setReviewStatus(doc.id, "draft", comment), ctx.statusLabels.draft)}>
                  {L.requestChanges}
                </button>
              </>
            ) : null}
          </div>
          <textarea className={`${input} min-h-16`} placeholder={L.comment} value={comment} onChange={(e) => setComment(e.target.value)} />
          <button type="button" disabled={pending || !comment.trim()} className="text-sm font-semibold text-brand disabled:opacity-40" onClick={() => act(() => addReviewComment(doc.id, comment), L.saved)}>
            {L.addComment}
          </button>
          <ul className="max-h-48 space-y-2 overflow-auto text-xs">
            {ctx.reviews.map((r) => (
              <li key={r.id} className="rounded bg-surface-2 p-2">
                <span className="font-semibold">
                  {r.kind} · {r.decision}
                </span>{" "}
                <span className="text-muted">
                  r{r.revision} · {new Date(r.createdAt).toLocaleString()}
                </span>
                {r.comment ? <p className="mt-1 whitespace-pre-line">{r.comment}</p> : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[var(--radius-md)] border border-line bg-surface p-4">
          <h2 className="font-sans text-sm font-bold">{L.versions}</h2>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs">
            {ctx.versions.map((v) => (
              <li key={v.versionNo} className="flex items-center justify-between gap-2">
                <span>
                  v{v.versionNo} · {v.kind} · {new Date(v.createdAt).toLocaleDateString()}
                </span>
                {canEdit && v.kind !== "unpublish" ? (
                  <button type="button" className="font-semibold text-brand" disabled={pending} onClick={() => act(() => restoreVersion(doc.id, v.versionNo), L.restore)} data-testid={`restore-${v.versionNo}`}>
                    {L.restore}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {canEdit ? (
          <div className="flex flex-wrap gap-3 text-sm">
            <button
              type="button"
              className="font-semibold text-brand"
              onClick={() =>
                start(async () => {
                  const r = await duplicateDocument(doc.id);
                  if (r.ok) router.push(`/${ctx.locale}/admin/edit/${r.id}`);
                  else toast(r.error, "error");
                })
              }
            >
              {L.duplicate}
            </button>
            {ctx.roles.includes("owner") ? (
              <button
                type="button"
                className="font-semibold text-danger"
                onClick={() => {
                  if (!window.confirm(L.delete + "?")) return;
                  start(async () => {
                    const r = await deleteDocument(doc.id);
                    if (r.ok) router.push(`/${ctx.locale}/admin`);
                    else toast(r.error, "error");
                  });
                }}
              >
                {L.delete}
              </button>
            ) : null}
            <Link href={`/${ctx.locale}/admin`} className="text-muted">
              ← {L.title}
            </Link>
          </div>
        ) : null}
      </aside>
    </div>
    </ControlLabels>
  );
}

function ProgramSteps({ steps, onChange, ctx }: { steps: any[]; onChange: (s: any[]) => void; ctx: EditorContext }) {
  const L = ctx.labels;
  const [open, setOpen] = useState<string | null>(null);
  const set = (i: number, patch: any) => onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <section data-testid="program-steps-editor">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{L.steps}</h3>
      <ol className="mt-2 space-y-2">
        {steps.map((s, i) => {
          const count = ctx.completionCounts[s.key] ?? 0;
          const ref = s.kind === "pose" ? ctx.poses.find((p) => p.value === s.poseId)?.label : s.kind === "exercise" ? ctx.exercises.find((p) => p.value === s.exerciseId)?.label : null;
          return (
            <li key={s.key} className="rounded-[var(--radius-sm)] border border-line" data-step-key={s.key}>
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" className="flex-1 truncate text-left text-sm" onClick={() => setOpen(open === s.key ? null : s.key)}>
                  <span className="font-semibold">
                    {i + 1}. {s.title?.ru || ref || "—"}
                  </span>{" "}
                  <span className="text-xs text-muted">· {s.kind}</span>
                  <span className="ml-2 font-mono text-[10px] text-muted">{String(s.key).slice(0, 8)}</span>
                  {count > 0 ? <span className="ml-2 rounded-full bg-warning-soft px-2 text-[10px] font-bold text-warning">✓ {count}</span> : null}
                </button>
                <ListControls
                  index={i}
                  length={steps.length}
                  onMove={(to) => onChange(moveItem(steps, i, to))}
                  onDuplicate={() => onChange([...steps.slice(0, i + 1), duplicateItem(s), ...steps.slice(i + 1)])}
                  onDelete={() => {
                    const msg = count > 0 ? `${L.deleteStepConfirm}\n${L.stepsWarning.replace("{n}", String(count))}` : L.deleteStepConfirm;
                    if (window.confirm(msg)) onChange(steps.filter((_, j) => j !== i));
                  }}
                />
              </div>
              {open === s.key ? (
                <div className="space-y-3 border-t border-line p-3">
                  {count > 0 ? <p className="rounded bg-warning-soft p-2 text-xs text-warning">{L.stepsWarning.replace("{n}", String(count))}</p> : null}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block text-xs font-bold uppercase text-muted">
                      {L.stepKind}
                      <select className={`${input} mt-1`} value={s.kind} onChange={(e) => set(i, { kind: e.target.value, poseId: undefined, exerciseId: undefined })}>
                        <option value="lesson">lesson</option>
                        <option value="exercise">exercise</option>
                        <option value="pose">pose</option>
                      </select>
                    </label>
                    {s.kind === "pose" ? (
                      <label className="block text-xs font-bold uppercase text-muted sm:col-span-2">
                        {L.selectPose}
                        <select className={`${input} mt-1`} value={s.poseId ?? ""} onChange={(e) => set(i, { poseId: e.target.value || undefined })}>
                          <option value="">—</option>
                          {ctx.poses.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {s.kind === "exercise" ? (
                      <label className="block text-xs font-bold uppercase text-muted sm:col-span-2">
                        {L.selectExercise}
                        <select className={`${input} mt-1`} value={s.exerciseId ?? ""} onChange={(e) => set(i, { exerciseId: e.target.value || undefined })}>
                          <option value="">—</option>
                          {ctx.exercises.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase text-muted">Title</span>
                    <LocInput value={s.title} onChange={(v) => set(i, { title: v })} />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase text-muted">Body</span>
                    <LocInput value={s.body} multiline onChange={(v) => set(i, { body: v })} />
                  </div>
                  <FieldEditor field={{ k: "durationMin", t: "number", label: "min", min: 1, max: 180 }} value={s.durationMin} onChange={(v) => set(i, { durationMin: v })} />
                  <FieldEditor field={{ k: "video", t: "video", label: "Video" }} value={s.video} onChange={(v) => set(i, { video: v })} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand"
        data-testid="add-step"
        onClick={() => {
          const key = newKey();
          onChange([...steps, { key, kind: "lesson", title: { ru: "", en: "" }, body: { ru: "", en: "" } }]);
          setOpen(key);
        }}
      >
        <Icon name="plus" size={16} /> {L.addStep}
      </button>
    </section>
  );
}
