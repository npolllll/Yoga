/**
 * Media URLs go through this helper so the hosting (Vercel static, Supabase Storage, a CDN in another
 * region) can be replaced without touching pages. Absolute URLs are returned unchanged.
 */
export function mediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;
  const base = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "").replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1, 12) || null;
    if (u.hostname.endsWith("youtube.com") || u.hostname.endsWith("youtube-nocookie.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch {
    return null;
  }
  return null;
}

export function providerLabel(provider: string): string {
  switch (provider) {
    case "youtube":
      return "YouTube";
    case "vk":
      return "VK Видео";
    case "rutube":
      return "Rutube";
    default:
      return "сайте автора";
  }
}
