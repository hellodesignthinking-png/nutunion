import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcDominantGenre, getDailySeedGenre, LogoGenre } from "@/lib/brand/genre-engine";

export const revalidate = 300; // cache 5 min

export async function GET() {
  try {
    const supabase = await createClient();

    // Count active projects by category
    const { data: projects } = await supabase
      .from("projects")
      .select("category")
      .eq("status", "active");

    // Count active groups by category
    const { data: groups } = await supabase
      .from("groups")
      .select("category")
      .eq("is_active", true);

    // Tally
    const counts: Record<string, number> = { space: 0, culture: 0, platform: 0, vibe: 0 };
    const projectCounts: Record<string, number> = { space: 0, culture: 0, platform: 0, vibe: 0 };
    const groupCounts: Record<string, number> = { space: 0, culture: 0, platform: 0, vibe: 0 };

    for (const p of projects || []) {
      const cat = p.category as string;
      if (cat in counts) {
        counts[cat] = (counts[cat] || 0) + 1;
        projectCounts[cat] = (projectCounts[cat] || 0) + 1;
      }
    }
    for (const g of groups || []) {
      const cat = g.category as string;
      if (cat in counts) {
        counts[cat] = (counts[cat] || 0) + 1;
        groupCounts[cat] = (groupCounts[cat] || 0) + 1;
      }
    }

    const result = calcDominantGenre(counts);

    return NextResponse.json({
      genre: result.genre,
      dominantCat: result.dominantCat,
      totalCount: result.totalCount,
      breakdown: result.breakdown,
      projectCounts,
      groupCounts,
      calculatedAt: new Date().toISOString(),
    });
  } catch {
    // Fallback to daily seed
    const genre = getDailySeedGenre();
    return NextResponse.json({
      genre,
      dominantCat: "space",
      totalCount: 0,
      breakdown: {},
      projectCounts: {},
      groupCounts: {},
      calculatedAt: new Date().toISOString(),
      fallback: true,
    });
  }
}
