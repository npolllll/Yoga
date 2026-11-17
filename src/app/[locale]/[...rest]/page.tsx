import { notFound } from "next/navigation";

// Unmatched localized URLs always 404; allow blocking (nothing to prerender here).
export const instant = false;

/** Unmatched localized URLs render the localized 404 inside the site layout. */
export default function CatchAll() {
  notFound();
}
