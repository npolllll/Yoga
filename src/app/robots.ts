import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/supabase/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/ru/admin", "/en/admin", "/api/", "/auth/", "/ru/account", "/en/account", "/ru/my-practice", "/en/my-practice"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
