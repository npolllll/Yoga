"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { youtubeId } from "@/lib/media";

export interface VideoLessonData {
  provider: "youtube" | "vk" | "rutube" | "other";
  url: string;
  title: string;
  author: string;
  durationSec?: number;
  startSec?: number;
  embeddable?: boolean;
}

/**
 * Facade: nothing from the video provider is requested until the user taps.
 * YouTube is embedded via youtube-nocookie.com. If embedding is not allowed or the player does not
 * load within 8 s (e.g. the provider is blocked in the user's network), a direct link is shown.
 */
export function VideoLesson({
  video,
  poster,
  labels,
}: {
  video: VideoLessonData;
  poster: string | null;
  labels: { play: string; watchOn: string; by: string; fallback: string; providerName: string };
}) {
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);
  const loaded = useRef(false);
  const id = video.provider === "youtube" ? youtubeId(video.url) : null;
  const canEmbed = video.embeddable !== false && !!id;

  useEffect(() => {
    if (!active) return;
    loaded.current = false;
    const timer = window.setTimeout(() => {
      if (!loaded.current) setFailed(true);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [active]);

  // Reset when the language (and therefore the lesson) changes.
  useEffect(() => {
    setActive(false);
    setFailed(false);
  }, [video.url]);

  const duration = video.durationSec
    ? `${Math.floor(video.durationSec / 60)}:${String(video.durationSec % 60).padStart(2, "0")}`
    : null;
  const src = id
    ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0${video.startSec ? `&start=${video.startSec}` : ""}`
    : "";

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-[var(--radius-lg)] bg-ink">
        {active && canEmbed && !failed ? (
          <iframe
            src={src}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
            className="absolute inset-0 h-full w-full"
            onLoad={() => (loaded.current = true)}
            data-testid="video-iframe"
          />
        ) : (
          <>
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element -- our own poster, no provider request
              <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" loading="lazy" />
            ) : (
              <div className="glow-surface absolute inset-0" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
            {canEmbed && !failed ? (
              <button
                type="button"
                onClick={() => setActive(true)}
                className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-ink shadow-lift transition-transform hover:scale-105"
                aria-label={labels.play}
                data-testid="video-play"
              >
                <Icon name="play" filled size={28} />
              </button>
            ) : null}
            <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3 text-white">
              <p className="line-clamp-2 text-sm font-semibold">{video.title}</p>
              {duration ? <span className="rounded bg-ink/70 px-2 py-0.5 text-xs">{duration}</span> : null}
            </div>
          </>
        )}
      </div>
      {failed ? (
        <p className="mt-3 text-sm text-muted" role="status">
          {labels.fallback}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{labels.by}</p>
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold hover:border-brand"
          data-testid="video-external-link"
        >
          {labels.watchOn}
          <Icon name="external" size={16} />
        </a>
      </div>
    </div>
  );
}
