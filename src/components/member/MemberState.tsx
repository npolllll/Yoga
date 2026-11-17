"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MemberStatePayload } from "@/app/api/me/state/route";
import { setFavorite, setPoseStatus, setStepCompletion } from "@/app/actions/member";
import { useToast } from "@/components/ui/Toast";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type PoseStatus = "not_started" | "in_progress" | "learned";
export type Intent =
  | { type: "fav"; poseId: string }
  | { type: "status"; poseId: string; status: PoseStatus }
  | { type: "step"; programId: string; stepKey: string };

interface MemberContextValue {
  status: "loading" | "guest" | "member";
  user: MemberStatePayload["user"];
  isFavorite: (poseId: string) => boolean;
  poseStatus: (poseId: string) => PoseStatus;
  poseUpdatedAt: (poseId: string) => string | null;
  isStepDone: (programId: string, stepKey: string) => boolean;
  completedSteps: (programId: string) => string[];
  state: MemberStatePayload;
  toggleFavorite: (poseId: string) => Promise<void>;
  changePoseStatus: (poseId: string, status: PoseStatus) => Promise<void>;
  toggleStep: (programId: string, stepKey: string) => Promise<void>;
  requireAuth: (intent: Intent) => void;
  authPrompt: Intent | null;
  closeAuthPrompt: () => void;
  refresh: () => Promise<void>;
}

const MemberContext = createContext<MemberContextValue | null>(null);

const EMPTY: MemberStatePayload = { user: null, favorites: [], progress: {}, completions: {} };

export function encodeIntent(intent: Intent): string {
  if (intent.type === "fav") return `fav:${intent.poseId}`;
  if (intent.type === "status") return `status:${intent.poseId}:${intent.status}`;
  return `step:${intent.programId}:${intent.stepKey}`;
}

function decodeIntent(raw: string | null): Intent | null {
  if (!raw) return null;
  const [type, a, b] = raw.split(":");
  const uuid = /^[0-9a-f-]{36}$/i;
  if (type === "fav" && uuid.test(a)) return { type, poseId: a };
  if (type === "status" && uuid.test(a) && ["in_progress", "learned", "not_started"].includes(b))
    return { type, poseId: a, status: b as PoseStatus };
  if (type === "step" && uuid.test(a) && uuid.test(b)) return { type, programId: a, stepKey: b };
  return null;
}

export function MemberStateProvider({ children, dict }: { children: ReactNode; dict: Dictionary["actions"] }) {
  const [state, setState] = useState<MemberStatePayload>(EMPTY);
  const [status, setStatus] = useState<"loading" | "guest" | "member">("loading");
  const [authPrompt, setAuthPrompt] = useState<Intent | null>(null);
  const toast = useToast();
  const intentHandled = useRef(false);
  // Every refresh/mutation bumps the sequence; a refresh response is applied only if nothing happened
  // after it was requested (prevents a slow, stale response from overwriting an optimistic update).
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await fetch("/api/me/state", { cache: "no-store", credentials: "same-origin" });
      const data = (await res.json()) as MemberStatePayload;
      if (mine !== seq.current) return;
      setState(data);
      setStatus(data.user ? "member" : "guest");
    } catch {
      if (mine === seq.current) setStatus("guest");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fail = useCallback(
    (previous: MemberStatePayload, error?: string) => {
      setState(previous);
      if (error === "auth") {
        setStatus("guest");
        toast(dict.signInToSave, "error");
      } else toast(dict.saveError, "error");
    },
    [dict, toast],
  );

  const toggleFavorite = useCallback(
    async (poseId: string) => {
      seq.current++;
      const prev = state;
      const on = !prev.favorites.includes(poseId);
      setState({ ...prev, favorites: on ? [...prev.favorites, poseId] : prev.favorites.filter((f) => f !== poseId) });
      const res = await setFavorite(poseId, on);
      if (!res.ok) fail(prev, res.error);
      else toast(on ? dict.favorited : dict.removeFavorite, "success");
    },
    [state, fail, toast, dict],
  );

  const changePoseStatus = useCallback(
    async (poseId: string, next: PoseStatus) => {
      seq.current++;
      const prev = state;
      const progress = { ...prev.progress };
      if (next === "not_started") delete progress[poseId];
      else progress[poseId] = { status: next, updatedAt: new Date().toISOString() };
      setState({ ...prev, progress });
      const res = await setPoseStatus(poseId, next);
      if (!res.ok) fail(prev, res.error);
      else toast(dict.statusValues[next], "success");
    },
    [state, fail, toast, dict],
  );

  const toggleStep = useCallback(
    async (programId: string, stepKey: string) => {
      seq.current++;
      const prev = state;
      const current = prev.completions[programId] ?? [];
      const done = !current.includes(stepKey);
      setState({
        ...prev,
        completions: { ...prev.completions, [programId]: done ? [...current, stepKey] : current.filter((k) => k !== stepKey) },
      });
      const res = await setStepCompletion(programId, stepKey, done);
      if (!res.ok) fail(prev, res.error);
      else toast(done ? dict.stepDone : dict.undo, "success");
    },
    [state, fail, toast, dict],
  );

  // After sign-in the user returns with ?intent=… — complete the original action once.
  useEffect(() => {
    if (status !== "member" || intentHandled.current) return;
    const url = new URL(window.location.href);
    const intent = decodeIntent(url.searchParams.get("intent"));
    if (!intent) return;
    intentHandled.current = true;
    url.searchParams.delete("intent");
    window.history.replaceState(window.history.state, "", url.toString());
    if (intent.type === "fav" && !state.favorites.includes(intent.poseId)) void toggleFavorite(intent.poseId);
    if (intent.type === "status") void changePoseStatus(intent.poseId, intent.status);
    if (intent.type === "step" && !(state.completions[intent.programId] ?? []).includes(intent.stepKey))
      void toggleStep(intent.programId, intent.stepKey);
  }, [status, state, toggleFavorite, changePoseStatus, toggleStep]);

  const value = useMemo<MemberContextValue>(
    () => ({
      status,
      user: state.user,
      state,
      isFavorite: (id) => state.favorites.includes(id),
      poseStatus: (id) => state.progress[id]?.status ?? "not_started",
      poseUpdatedAt: (id) => state.progress[id]?.updatedAt ?? null,
      isStepDone: (programId, key) => (state.completions[programId] ?? []).includes(key),
      completedSteps: (programId) => state.completions[programId] ?? [],
      toggleFavorite,
      changePoseStatus,
      toggleStep,
      requireAuth: (intent) => setAuthPrompt(intent),
      authPrompt,
      closeAuthPrompt: () => setAuthPrompt(null),
      refresh,
    }),
    [status, state, toggleFavorite, changePoseStatus, toggleStep, authPrompt, refresh],
  );

  return <MemberContext value={value}>{children}</MemberContext>;
}

export function useMember() {
  const ctx = useContext(MemberContext);
  if (!ctx) throw new Error("useMember must be used inside MemberStateProvider");
  return ctx;
}
