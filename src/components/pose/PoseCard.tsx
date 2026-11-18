import Link from "next/link";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { Icon } from "@/components/ui/Icon";
import { mediaUrl } from "@/lib/media";
import { FavoriteButton } from "./PoseActions";

export interface PoseCardData {
  id: string;
  slug: string;
  name: string;
  secondary: string; // Sanskrit or English name
  levelRank: number;
  levelLabel: string;
  card: { url: string; width: number | null; height: number | null } | null;
}

export function PoseImage({
  card,
  alt,
  priority = false,
  sizes = "(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw",
}: {
  card: PoseCardData["card"];
  alt: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (!card) {
    return (
      <div className="glow-surface flex aspect-[4/3] w-full items-center justify-center text-mauve" aria-hidden="true">
        <Icon name="lotus" size={44} strokeWidth={1.2} />
      </div>
    );
  }
  const src = mediaUrl(card.url);
  // Cards ship a 2x rendition next to the 1x file (name@2x.webp) — see pipeline/export.
  const src2x = src.replace(/\.webp$/, "@2x.webp");
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-optimized WebP with explicit srcset
    <img
      src={src}
      srcSet={`${src} 1x, ${src2x} 2x`}
      sizes={sizes}
      alt={alt}
      width={card.width ?? 480}
      height={card.height ?? 360}
      loading={priority ? "eager" : "lazy"}
      // No fetchPriority="high": the library is prefetched from every page (header link), and a high-priority
      // image in a prefetched route is preloaded there too, competing with that page's own LCP image.
      decoding="async"
      className="aspect-[4/3] w-full object-contain"
    />
  );
}

export function PoseCard({
  pose,
  href,
  priority,
  favoriteLabels,
  levelAria,
}: {
  pose: PoseCardData;
  href: string;
  priority?: boolean;
  favoriteLabels: { add: string; remove: string; added: string };
  levelAria: string;
}) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-soft transition-shadow hover:shadow-lift">
      <div className="relative bg-surface-2">
        <PoseImage card={pose.card} alt="" priority={priority} />
        <div className="absolute right-2 top-2">
          <FavoriteButton poseId={pose.id} labels={favoriteLabels} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-lg leading-snug">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {pose.name}
          </Link>
        </h3>
        {pose.secondary ? <p className="text-sm text-muted">{pose.secondary}</p> : null}
        <div className="mt-auto pt-3">
          <LevelBadge rank={pose.levelRank} label={pose.levelLabel} ariaLabel={levelAria} />
        </div>
      </div>
    </article>
  );
}
