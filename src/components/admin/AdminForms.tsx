"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { LocInput, input, type Loc } from "./fields";
import { deleteMedia, refreshPublicCache, saveSettings, saveTaxonomyItem, setUserRole, updateMedia, uploadMedia } from "@/app/actions/admin";

const btn = "h-10 rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:opacity-50";

export function MediaUpload({ documents, labels }: { documents: { id: string; label: string }[]; labels: Record<string, string> }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <form
      className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const file = form.get("file") as File;
        const finish = () =>
          start(async () => {
            const r = await uploadMedia(form);
            if (r.ok) {
              toast(labels.saved, "success");
              router.refresh();
            } else toast(`${labels.error}: ${r.error}`, "error");
          });
        if (file && file.type.startsWith("image/")) {
          const img = new Image();
          img.onload = () => {
            form.set("width", String(img.naturalWidth));
            form.set("height", String(img.naturalHeight));
            finish();
          };
          img.onerror = finish;
          img.src = URL.createObjectURL(file);
        } else finish();
      }}
      data-testid="media-upload"
    >
      <input type="file" name="file" required accept="image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm" className="sm:col-span-2" />
      <label className="text-sm">
        {labels.kind}
        <select name="kind" className={`${input} mt-1`} defaultValue="image">
          {["image", "illustration", "poster", "card", "keyframe", "animation"].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        {labels.attachTo}
        <select name="documentId" className={`${input} mt-1`} defaultValue="">
          <option value="">—</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <input name="altRu" className={input} placeholder={labels.altRu} />
      <input name="altEn" className={input} placeholder={labels.altEn} />
      <button className={`${btn} sm:col-span-2 sm:w-max`} disabled={pending}>
        {pending ? labels.uploading : labels.upload}
      </button>
    </form>
  );
}

export function MediaRow({ id, alt, checkStatus, labels }: { id: string; alt: Loc; checkStatus: string; labels: Record<string, string> }) {
  const [value, setValue] = useState<Loc>(alt);
  const [status, setStatus] = useState(checkStatus);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <div className="space-y-2">
      <LocInput value={value} onChange={setValue} />
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${input} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)} disabled={status === "expert_approved"}>
          {["unchecked", "auto_passed", "auto_failed", "visual_ok"].map((s) => (
            <option key={s}>{s}</option>
          ))}
          {status === "expert_approved" ? <option>expert_approved</option> : null}
        </select>
        <button
          type="button"
          className="text-sm font-semibold text-brand"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateMedia(id, { alt: value, checkStatus: status });
              toast(r.ok ? labels.saved : labels.error, r.ok ? "success" : "error");
            })
          }
        >
          {labels.save}
        </button>
        <button
          type="button"
          className="text-sm font-semibold text-danger"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(labels.delete + "?")) return;
            start(async () => {
              const r = await deleteMedia(id);
              if (r.ok) router.refresh();
              else toast(labels.error, "error");
            });
          }}
        >
          {labels.delete}
        </button>
      </div>
    </div>
  );
}

export function SettingsForm({
  initial,
  levels,
  labels,
  isOwner,
}: {
  initial: { levelLabelOverrides: Record<string, Loc>; contact: { email: string | null; socials: { label: string; url: string }[] }; allowUnreviewedPublish: boolean };
  levels: { key: string; label: Loc }[];
  labels: Record<string, string>;
  isOwner: boolean;
}) {
  const [state, setState] = useState(initial);
  const [socials, setSocials] = useState(initial.contact.socials.map((s) => `${s.label} | ${s.url}`).join("\n"));
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <form
      className="space-y-5 rounded-[var(--radius-md)] border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = socials
          .split("\n")
          .map((l) => l.split("|").map((x) => x.trim()))
          .filter((p) => p.length === 2 && p[0] && p[1])
          .map(([label, url]) => ({ label, url }));
        start(async () => {
          const r = await saveSettings({ ...state, contact: { email: state.contact.email || null, socials: parsed } });
          toast(r.ok ? labels.saved : `${labels.error}: ${r.ok ? "" : r.error}`, r.ok ? "success" : "error");
        });
      }}
      data-testid="settings-form"
    >
      <fieldset disabled={!isOwner} className="space-y-5">
        <div>
          <h2 className="text-lg">{labels.levelLabels}</h2>
          <div className="mt-2 space-y-3">
            {levels.map((l) => (
              <div key={l.key}>
                <span className="font-mono text-xs text-muted">
                  {l.key} ({l.label.ru} / {l.label.en})
                </span>
                <LocInput
                  value={state.levelLabelOverrides[l.key] ?? { ru: "", en: "" }}
                  onChange={(v) => {
                    const next = { ...state.levelLabelOverrides };
                    if (v.ru || v.en) next[l.key] = v;
                    else delete next[l.key];
                    setState({ ...state, levelLabelOverrides: next });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-lg">{labels.contacts}</h2>
          <input className={`${input} mt-2`} type="email" placeholder="email@example.com" value={state.contact.email ?? ""} onChange={(e) => setState({ ...state, contact: { ...state.contact, email: e.target.value } })} />
          <textarea className={`${input} mt-2 min-h-20`} placeholder="Instagram | https://…" value={socials} onChange={(e) => setSocials(e.target.value)} />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={state.allowUnreviewedPublish} onChange={(e) => setState({ ...state, allowUnreviewedPublish: e.target.checked })} />
          {labels.allowUnreviewed}
        </label>
        <button className={btn} disabled={pending}>
          {labels.saveSettings}
        </button>
      </fieldset>
    </form>
  );
}

export function TaxonomyEditor({ kind, items, labels }: { kind: "categories" | "skills" | "levels"; items: { key: string; name: Loc; description?: Loc }[]; labels: Record<string, string> }) {
  const [list, setList] = useState(items);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <ul className="space-y-3">
      {list.map((item, i) => (
        <li key={item.key} className="rounded-[var(--radius-sm)] border border-line bg-surface p-3">
          <span className="font-mono text-xs text-muted">{item.key}</span>
          <LocInput value={item.name} onChange={(v) => setList(list.map((x, j) => (j === i ? { ...x, name: v } : x)))} />
          {item.description ? (
            <div className="mt-2">
              <LocInput value={item.description} onChange={(v) => setList(list.map((x, j) => (j === i ? { ...x, description: v } : x)))} />
            </div>
          ) : null}
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-brand"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveTaxonomyItem(kind, list[i]);
                toast(r.ok ? labels.saved : labels.error, r.ok ? "success" : "error");
              })
            }
          >
            {labels.save}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function RoleForm({ labels }: { labels: Record<string, string> }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"reviewer" | "editor" | "owner">("editor");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (grant: boolean) =>
    start(async () => {
      const r = await setUserRole(email, role, grant);
      if (r.ok) {
        toast(labels.saved, "success");
        router.refresh();
      } else toast(`${labels.error}: ${r.error}`, "error");
    });
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-[var(--radius-md)] border border-line bg-surface p-4">
      <label className="text-sm">
        {labels.email}
        <input className={`${input} mt-1 w-64`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="text-sm">
        {labels.role}
        <select className={`${input} mt-1`} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="editor">editor</option>
          <option value="reviewer">reviewer</option>
          <option value="owner">owner</option>
        </select>
      </label>
      <button type="button" className={btn} disabled={pending || !email} onClick={() => run(true)}>
        {labels.grant}
      </button>
      <button type="button" className="h-10 rounded-full border border-line-strong px-5 text-sm font-semibold" disabled={pending || !email} onClick={() => run(false)}>
        {labels.revoke}
      </button>
    </div>
  );
}

export function CacheRefresh({ labels }: { labels: Record<string, string> }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4" data-testid="cache-refresh">
      <button
        type="button"
        className="h-10 rounded-full border border-line-strong px-5 text-sm font-semibold disabled:opacity-50"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await refreshPublicCache();
            toast(r.ok ? labels.cacheRefreshed : `${labels.error}: ${r.ok ? "" : r.error}`, r.ok ? "success" : "error");
          })
        }
      >
        {labels.refreshCache}
      </button>
      <p className="text-sm text-muted">{labels.refreshCacheHint}</p>
    </div>
  );
}
