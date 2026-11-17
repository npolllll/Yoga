"use client";

import Link from "next/link";
import { useMember } from "@/components/member/MemberState";
import { programProgress } from "@/lib/content/step-keys";
import { Icon } from "@/components/ui/Icon";
import { fmt } from "@/lib/i18n/format";

export interface StepRow {
  key: string;
  kind: "lesson" | "exercise" | "pose";
  title: string;
  kindLabel: string;
  poseId?: string;
}

export function ProgressBar({ programId, stepKeys, labels }: { programId: string; stepKeys: string[]; labels: { progress: string } }) {
  const member = useMember();
  if (member.status !== "member") return null;
  const p = programProgress(stepKeys, member.completedSteps(programId));
  return (
    <div data-testid="program-progress" data-completed={p.completed} data-total={p.total}>
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>{fmt(labels.progress, { done: p.completed, total: p.total })}</span>
        <span className="text-muted">{p.percent}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent}>
        <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${p.percent}%` }} />
      </div>
    </div>
  );
}

export function ContinueButton({
  programId,
  stepKeys,
  baseHref,
  labels,
}: {
  programId: string;
  stepKeys: string[];
  baseHref: string;
  labels: { start: string; continueFrom: string; completed: string };
}) {
  const member = useMember();
  const p = programProgress(stepKeys, member.status === "member" ? member.completedSteps(programId) : []);
  if (stepKeys.length === 0) return null;
  const done = p.total > 0 && p.completed === p.total;
  const target = p.nextKey ?? stepKeys[0];
  const index = stepKeys.indexOf(target) + 1;
  return (
    <Link
      href={`${baseHref}/steps/${target}`}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand-hover"
      data-testid="program-continue"
    >
      {done ? labels.completed : p.completed > 0 ? fmt(labels.continueFrom, { n: index }) : labels.start}
      <Icon name="arrowRight" size={18} />
    </Link>
  );
}

export function StepList({
  programId,
  steps,
  baseHref,
  labels,
}: {
  programId: string;
  steps: StepRow[];
  baseHref: string;
  labels: { done: string; learned: string };
}) {
  const member = useMember();
  const signedIn = member.status === "member";
  return (
    <ol className="space-y-3" data-testid="program-steps">
      {steps.map((s, i) => {
        const done = signedIn && member.isStepDone(programId, s.key);
        const learned = signedIn && s.poseId ? member.poseStatus(s.poseId) === "learned" : false;
        return (
          <li key={s.key} data-step-key={s.key} data-done={done ? "true" : "false"}>
            <Link href={`${baseHref}/steps/${s.key}`} className="flex items-center gap-4 rounded-[var(--radius-md)] border border-line bg-surface p-4 transition-colors hover:border-brand">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-success text-white" : "bg-surface-2 text-ink"}`}
                aria-hidden="true"
              >
                {done ? <Icon name="check" size={18} /> : i + 1}
              </span>
              <span className="flex-1">
                <span className="block text-xs font-bold uppercase tracking-wide text-muted">{s.kindLabel}</span>
                <span className="block font-semibold">{s.title}</span>
              </span>
              {done ? <span className="sr-only">{labels.done}</span> : null}
              {learned ? (
                <span className="hidden rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success sm:inline">{labels.learned}</span>
              ) : null}
              <Icon name="chevronRight" className="shrink-0 text-muted" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function StepCompleteButton({
  programId,
  stepKey,
  labels,
}: {
  programId: string;
  stepKey: string;
  labels: { mark: string; done: string; undo: string };
}) {
  const member = useMember();
  const done = member.status === "member" && member.isStepDone(programId, stepKey);
  return (
    <button
      type="button"
      aria-pressed={done}
      data-testid="step-complete"
      onClick={() => {
        if (member.status !== "member") return member.requireAuth({ type: "step", programId, stepKey });
        void member.toggleStep(programId, stepKey);
      }}
      className={`inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 font-semibold transition-colors ${
        done ? "bg-success-soft text-success ring-1 ring-success" : "bg-brand text-white hover:bg-brand-hover"
      }`}
    >
      <Icon name="check" size={18} />
      {done ? `${labels.done} · ${labels.undo}` : labels.mark}
    </button>
  );
}
