import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = "https://nutunion.co.kr";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/groups`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/projects`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/wiki`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/brand`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  let dynamicEntries: MetadataRoute.Sitemap = [];

  try {
    const supabase = await createClient();

    const [{ data: groups }, { data: projects }, { data: wikis }] = await Promise.all([
      supabase.from("groups").select("id, updated_at").limit(500),
      supabase.from("projects").select("id, updated_at").limit(500),
      supabase
        .from("wiki_topics")
        .select("public_slug, published_at")
        .eq("is_public", true)
        .not("public_slug", "is", null)
        .limit(500),
    ]);

    const groupEntries = (groups || []).map((g: any) => ({
      url: `${BASE_URL}/groups/${g.id}`,
      lastModified: g.updated_at ? new Date(g.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const projectEntries = (projects || []).map((p: any) => ({
      url: `${BASE_URL}/projects/${p.id}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const wikiEntries = (wikis || [])
      .filter((w: any) => w.public_slug)
      .map((w: any) => ({
        url: `${BASE_URL}/wiki/${w.public_slug}`,
        lastModified: w.published_at ? new Date(w.published_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));

    dynamicEntries = [...groupEntries, ...projectEntries, ...wikiEntries];
  } catch {
    // Fall back to static-only if DB not reachable at build time.
  }

  return [...staticEntries, ...dynamicEntries];
}
