"use client";

import { createContext, useContext, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { duplicateItem, moveItem, newKey } from "@/lib/content/step-keys";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Loc = { ru: string; en: string };
export interface Option {
  value: string;
  label: string;
}

export type Field =
  | { k: string; t: "loc"; label: string; multiline?: boolean; hint?: string }
  | { k: string; t: "text"; label: string; hint?: string; placeholder?: string }
  | { k: string; t: "number"; label: string; min?: number; max?: number; step?: number }
  | { k: string; t: "tags"; label: string; hint?: string }
  | { k: string; t: "multi"; label: string; options: Option[] }
  | { k: string; t: "select"; label: string; options: Option[]; allowEmpty?: boolean }
  | { k: string; t: "locList"; label: string; multiline?: boolean }
  | { k: string; t: "list"; label: string; item: Field[]; keyed?: boolean; summary?: (v: any, i: number) => string; empty: () => any }
  | { k: string; t: "video"; label: string }
  | { k: string; t: "blocks"; label: string; keys: string[] }
  | { k: string; t: "group"; label: string; fields: Field[] };

export const input =
  "w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const labelCls = "block text-xs font-bold uppercase tracking-wide text-muted";

export function LocInput({ value, onChange, multiline }: { value: Loc | undefined; onChange: (v: Loc) => void; multiline?: boolean }) {
  const v = value ?? { ru: "", en: "" };
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {(["ru", "en"] as const).map((l) => (
        <label key={l} className="relative block">
          <span className={`absolute right-2 top-1.5 text-[10px] font-bold uppercase ${v[l]?.trim() ? "text-muted" : "text-danger"}`}>{l}</span>
          {multiline ? (
            <textarea className={`${input} min-h-24 pr-8`} value={v[l] ?? ""} lang={l} onChange={(e) => onChange({ ...v, [l]: e.target.value })} />
          ) : (
            <input className={`${input} pr-8`} value={v[l] ?? ""} lang={l} onChange={(e) => onChange({ ...v, [l]: e.target.value })} />
          )}
        </label>
      ))}
    </div>
  );
}

/** Localized accessible names for list controls (provided by DocEditor). */
export const ControlLabels = createContext({ up: "Up", down: "Down", duplicate: "Duplicate", remove: "Delete" });

export function ListControls({ index, length, onMove, onDuplicate, onDelete }: { index: number; length: number; onMove: (to: number) => void; onDuplicate?: () => void; onDelete: () => void }) {
  const l = useContext(ControlLabels);
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="rounded p-1.5 hover:bg-surface-2 disabled:opacity-30" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={l.up}>
        <Icon name="up" size={16} />
      </button>
      <button type="button" className="rounded p-1.5 hover:bg-surface-2 disabled:opacity-30" disabled={index === length - 1} onClick={() => onMove(index + 1)} aria-label={l.down}>
        <Icon name="down" size={16} />
      </button>
      {onDuplicate ? (
        <button type="button" className="rounded p-1.5 hover:bg-surface-2" onClick={onDuplicate} aria-label={l.duplicate}>
          <Icon name="layers" size={16} />
        </button>
      ) : null}
      <button type="button" className="rounded p-1.5 text-danger hover:bg-danger-soft" onClick={onDelete} aria-label={l.remove}>
        <Icon name="trash" size={16} />
      </button>
    </div>
  );
}

function VideoInput({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const v = value ?? {};
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(["ru", "en"] as const).map((l) => {
        const ref = v[l] ?? null;
        const set = (patch: any) => onChange({ ...v, [l]: patch === null ? null : { provider: "youtube", ...(ref ?? {}), ...patch } });
        return (
          <fieldset key={l} className="space-y-2 rounded-[var(--radius-sm)] border border-line p-3">
            <legend className="px-1 text-xs font-bold uppercase">{l}</legend>
            <select className={input} value={ref?.provider ?? "youtube"} onChange={(e) => set({ provider: e.target.value })}>
              <option value="youtube">YouTube</option>
              <option value="vk">VK Видео</option>
              <option value="rutube">Rutube</option>
              <option value="other">Other</option>
            </select>
            <input className={input} placeholder="https://…" value={ref?.url ?? ""} onChange={(e) => set({ url: e.target.value })} />
            <input className={input} placeholder="Title" value={ref?.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
            <input className={input} placeholder="Author / channel" value={ref?.author ?? ""} onChange={(e) => set({ author: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <input className={input} type="number" placeholder="sec" value={ref?.durationSec ?? ""} onChange={(e) => set({ durationSec: e.target.value ? Number(e.target.value) : undefined })} title="durationSec" />
              <input className={input} type="number" placeholder="start" value={ref?.startSec ?? ""} onChange={(e) => set({ startSec: e.target.value ? Number(e.target.value) : undefined })} title="startSec" />
              <input className={input} type="date" value={ref?.verifiedAt ?? ""} onChange={(e) => set({ verifiedAt: e.target.value || undefined })} title="verifiedAt" />
            </div>
            <input className={input} placeholder="Review note (internal)" value={ref?.reviewNote ?? ""} onChange={(e) => set({ reviewNote: e.target.value || undefined })} />
            {ref ? (
              <button type="button" className="text-xs font-semibold text-danger" onClick={() => set(null)}>
                ✕ remove
              </button>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}

export function FieldEditor({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  switch (field.t) {
    case "loc":
      return (
        <div>
          <span className={labelCls}>{field.label}</span>
          <div className="mt-1.5">
            <LocInput value={value} onChange={onChange} multiline={field.multiline} />
          </div>
          {field.hint ? <p className="mt-1 text-xs text-muted">{field.hint}</p> : null}
        </div>
      );
    case "text":
      return (
        <label className="block">
          <span className={labelCls}>{field.label}</span>
          <input className={`${input} mt-1.5`} value={value ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
          {field.hint ? <span className="mt-1 block text-xs text-muted">{field.hint}</span> : null}
        </label>
      );
    case "number":
      return (
        <label className="block">
          <span className={labelCls}>{field.label}</span>
          <input
            className={`${input} mt-1.5`}
            type="number"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
      );
    case "tags":
      return (
        <label className="block">
          <span className={labelCls}>{field.label}</span>
          <input
            className={`${input} mt-1.5`}
            value={(value ?? []).join(", ")}
            onChange={(e) =>
              onChange(
                e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              )
            }
          />
          <span className="mt-1 block text-xs text-muted">{field.hint ?? "Через запятую / comma-separated"}</span>
        </label>
      );
    case "multi":
      return (
        <fieldset>
          <legend className={labelCls}>{field.label}</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {field.options.map((o) => {
              const on = (value ?? []).includes(o.value);
              return (
                <button
                  type="button"
                  key={o.value}
                  aria-pressed={on}
                  onClick={() => onChange(on ? value.filter((x: string) => x !== o.value) : [...(value ?? []), o.value])}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${on ? "border-brand bg-brand text-white" : "border-line bg-surface"}`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      );
    case "select":
      return (
        <label className="block">
          <span className={labelCls}>{field.label}</span>
          <select className={`${input} mt-1.5`} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
            {field.allowEmpty !== false ? <option value="">—</option> : null}
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      );
    case "locList": {
      const list: Loc[] = value ?? [];
      return (
        <div>
          <span className={labelCls}>{field.label}</span>
          <ul className="mt-1.5 space-y-2">
            {list.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <div className="flex-1">
                  <LocInput value={item} multiline={field.multiline} onChange={(v) => onChange(list.map((x, j) => (j === i ? v : x)))} />
                </div>
                <ListControls index={i} length={list.length} onMove={(to) => onChange(moveItem(list, i, to))} onDelete={() => onChange(list.filter((_, j) => j !== i))} />
              </li>
            ))}
          </ul>
          <button type="button" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand" onClick={() => onChange([...list, { ru: "", en: "" }])}>
            <Icon name="plus" size={16} /> {field.label}
          </button>
        </div>
      );
    }
    case "list": {
      const list: any[] = value ?? [];
      return (
        <div>
          <span className={labelCls}>{field.label}</span>
          <ol className="mt-1.5 space-y-2">
            {list.map((item, i) => (
              <li key={field.keyed ? item.key : i} className="rounded-[var(--radius-sm)] border border-line bg-surface">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button type="button" className="flex-1 truncate text-left text-sm font-semibold" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                    {i + 1}. {field.summary ? field.summary(item, i) : `#${i + 1}`}
                    {field.keyed ? <span className="ml-2 font-mono text-[10px] text-muted">{String(item.key).slice(0, 8)}</span> : null}
                  </button>
                  <ListControls
                    index={i}
                    length={list.length}
                    onMove={(to) => onChange(moveItem(list, i, to))}
                    onDuplicate={() => onChange([...list.slice(0, i + 1), field.keyed ? duplicateItem(item) : structuredClone(item), ...list.slice(i + 1)])}
                    onDelete={() => onChange(list.filter((_, j) => j !== i))}
                  />
                </div>
                {open === i ? (
                  <div className="space-y-3 border-t border-line p-3">
                    {field.item.map((f) => (
                      <FieldEditor key={f.k} field={f} value={item[f.k]} onChange={(v) => onChange(list.map((x, j) => (j === i ? { ...x, [f.k]: v } : x)))} />
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand"
            onClick={() => {
              const item = field.empty();
              onChange([...list, field.keyed ? { ...item, key: newKey() } : item]);
              setOpen(list.length);
            }}
          >
            <Icon name="plus" size={16} /> {field.label}
          </button>
        </div>
      );
    }
    case "video":
      return (
        <div>
          <span className={labelCls}>{field.label}</span>
          <div className="mt-1.5">
            <VideoInput value={value} onChange={onChange} />
          </div>
        </div>
      );
    case "blocks": {
      const v = value ?? {};
      return (
        <div>
          <span className={labelCls}>{field.label}</span>
          <div className="mt-1.5 space-y-3">
            {field.keys.map((k) => (
              <div key={k}>
                <span className="font-mono text-xs text-muted">{k}</span>
                <LocInput
                  value={v[k]}
                  onChange={(nv) => {
                    const next = { ...v, [k]: nv };
                    if (!nv.ru && !nv.en) delete next[k];
                    onChange(next);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "group":
      return (
        <fieldset className="space-y-3 rounded-[var(--radius-sm)] border border-line p-3">
          <legend className="px-1 text-xs font-bold uppercase">{field.label}</legend>
          {field.fields.map((f) => (
            <FieldEditor key={f.k} field={f} value={(value ?? {})[f.k]} onChange={(v) => onChange({ ...(value ?? {}), [f.k]: v })} />
          ))}
        </fieldset>
      );
  }
}
