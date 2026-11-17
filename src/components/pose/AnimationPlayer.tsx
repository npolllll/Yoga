"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";

export interface AnimationSource {
  url: string;
  mime: string; // e.g. 'video/mp4; codecs="avc1.640028"'
}

export interface Phase {
  fromSec: number;
  toSec: number;
  label: string;
}

/**
 * Poster first; the video is created only after the user taps play (no bytes downloaded before).
 * Plays muted inline, loops up to 3 times (never loops with reduced motion), pause/replay controls,
 * phase captions rendered by the UI (the clip has no text and no sound).
 */
export function AnimationPlayer({
  poster,
  posterAlt,
  sources,
  phases,
  labels,
  width,
  height,
}: {
  poster: string | null;
  posterAlt: string;
  sources: AnimationSource[];
  phases: Phase[];
  labels: { play: string; pause: string; replay: string; playCta: string; reducedMotion: string; missing: string; animation: string };
  width: number;
  height: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"idle" | "playing" | "paused" | "ended">("idle");
  const [time, setTime] = useState(0);
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  const plays = useRef(0);

  const start = () => {
    plays.current = 0;
    setState("playing");
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v || state !== "playing") return;
    void v.play().catch(() => setState("paused"));
  }, [state]);

  const phase = phases.find((p) => time >= p.fromSec && time < p.toSec) ?? (state === "ended" ? phases.at(-1) : undefined);
  const hasVideo = sources.length > 0;

  return (
    <figure className="relative">
      <div
        className="relative overflow-hidden rounded-[var(--radius-lg)] bg-surface-2"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {state === "idle" || !hasVideo ? (
          poster ? (
            // eslint-disable-next-line @next/next/no-img-element -- pre-optimized poster
            <img src={poster} alt={posterAlt} width={width} height={height} fetchPriority="high" className="h-full w-full object-contain" />
          ) : (
            <div className="glow-surface flex h-full w-full items-center justify-center text-mauve" role="img" aria-label={posterAlt}>
              <Icon name="lotus" size={64} strokeWidth={1} />
            </div>
          )
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            preload="none"
            poster={poster ?? undefined}
            width={width}
            height={height}
            className="h-full w-full object-contain"
            aria-label={labels.animation}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onPause={() => setState((s) => (s === "playing" ? "paused" : s))}
            onPlay={() => setState("playing")}
            onEnded={(e) => {
              plays.current += 1;
              if (!reduced && plays.current < 3) {
                e.currentTarget.currentTime = 0;
                void e.currentTarget.play();
              } else setState("ended");
            }}
            data-testid="pose-animation-video"
          >
            {sources.map((s) => (
              <source key={s.url} src={s.url} type={s.mime} />
            ))}
          </video>
        )}

        {hasVideo && state === "idle" ? (
          <button
            type="button"
            onClick={start}
            className="absolute inset-x-0 bottom-4 mx-auto flex w-max items-center gap-2 rounded-full bg-ink/85 px-5 py-3 text-sm font-semibold text-white shadow-lift backdrop-blur transition-transform hover:scale-[1.03]"
            data-testid="play-animation"
          >
            <Icon name="play" filled size={18} />
            {labels.playCta}
          </button>
        ) : null}

        {hasVideo && state !== "idle" ? (
          <div className="absolute bottom-3 right-3 flex gap-2">
            {state === "playing" ? (
              <button type="button" onClick={() => videoRef.current?.pause()} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink/80 text-white" aria-label={labels.pause}>
                <Icon name="pause" filled />
              </button>
            ) : (
              <button type="button" onClick={() => (state === "ended" ? start() : void videoRef.current?.play())} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink/80 text-white" aria-label={state === "ended" ? labels.replay : labels.play}>
                <Icon name={state === "ended" ? "replay" : "play"} filled={state !== "ended"} />
              </button>
            )}
          </div>
        ) : null}
      </div>
      <figcaption className="mt-3 min-h-6 text-sm text-muted" aria-live="off">
        {!hasVideo ? labels.missing : phase && state !== "idle" ? <span className="font-semibold text-ink">{phase.label}</span> : reduced ? labels.reducedMotion : null}
      </figcaption>
    </figure>
  );
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function prefersReducedMotion() {
  return window.matchMedia(REDUCED_MOTION).matches;
}
