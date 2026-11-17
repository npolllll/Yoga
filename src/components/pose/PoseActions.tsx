"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useMember } from "@/components/member/MemberState";

export function FavoriteButton({
  poseId,
  labels,
  variant = "icon",
}: {
  poseId: string;
  labels: { add: string; remove: string; added: string };
  variant?: "icon" | "button";
}) {
  const member = useMember();
  const [pop, setPop] = useState(false);
  const active = member.isFavorite(poseId);
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (member.status === "loading") return; // state not known yet: do not treat as a guest
    if (member.status !== "member") return member.requireAuth({ type: "fav", poseId });
    setPop(true);
    void member.toggleFavorite(poseId);
  };
  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        data-testid="favorite-button"
        className={`inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border px-5 font-semibold transition-colors ${
          active ? "border-brand bg-surface-2 text-brand" : "border-line-strong bg-surface hover:border-brand"
        }`}
      >
        <Icon name="heart" filled={active} className={pop ? "heart-pop" : ""} onAnimationEnd={() => setPop(false)} />
        {active ? labels.added : labels.add}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? labels.remove : labels.add}
      data-testid="favorite-icon"
      className={`relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 transition-colors hover:bg-surface ${
        active ? "text-brand" : "text-ink"
      }`}
    >
      <Icon name="heart" filled={active} className={pop ? "heart-pop" : ""} onAnimationEnd={() => setPop(false)} />
    </button>
  );
}

type Status = "not_started" | "in_progress" | "learned";

export function StatusControl({
  poseId,
  labels,
}: {
  poseId: string;
  labels: { title: string; values: Record<Status, string> };
}) {
  const member = useMember();
  const current = member.poseStatus(poseId);
  const options: Status[] = ["not_started", "in_progress", "learned"];
  return (
    <fieldset className="w-full">
      <legend className="mb-2 text-sm font-semibold text-muted">{labels.title}</legend>
      <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-full border border-line bg-surface p-1" data-testid="status-control">
        {options.map((s) => {
          const active = current === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              data-status={s}
              disabled={member.status === "loading"}
              onClick={() => {
                if (member.status === "loading") return;
                if (member.status !== "member") return member.requireAuth({ type: "status", poseId, status: s });
                if (!active) void member.changePoseStatus(poseId, s);
              }}
              className={`flex min-h-10 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold transition-colors ${
                active ? (s === "learned" ? "bg-success text-white" : "bg-ink text-white") : "text-muted hover:text-ink"
              }`}
            >
              {active && s === "learned" ? <Icon name="check" size={16} /> : null}
              {labels.values[s]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
