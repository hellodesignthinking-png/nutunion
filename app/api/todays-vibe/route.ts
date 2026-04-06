import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcVibeResult, getDailySeedGenre } from "@/lib/brand/genre-engine";

export const revalidate = 300; // 5분 캐시

export async function GET() {
  try {
    const supabase = await createClient();

    // Active projects by category
    const { data: projects } = await supabase
      .from("projects")
      .select("category")
      .eq("status", "active");

    // Active groups by category
    const { data: groups } = await supabase
      .from("groups")
      .select("category")
      .eq("is_active", true);

    const counts: Record<string, number> = { space: 0, culture: 0, platform: 0, vibe: 0 };
    const projectCounts: Record<string, number> = { ...counts };
    const groupCounts: Record<string, number> = { ...counts };

    for (const p of projects ?? []) {
      const c = p.category as string;
      if (c in counts) { counts[c]++; projectCounts[c]++; }
    }
    for (const g of groups ?? []) {
      const c = g.category as string;
      if (c in counts) { counts[c]++; groupCounts[c]++; }
    }

    const vibeResult = calcVibeResult(counts);

    return NextResponse.json({
      ...vibeResult,
      projectCounts,
      groupCounts,
      totalProjects: projects?.length ?? 0,
      totalGroups: groups?.length ?? 0,
      calculatedAt: new Date().toISOString(),
    });
  } catch {
    const genre = getDailySeedGenre();
    return NextResponse.json({
      genre,
      isHybrid: false,
      dominantCat: "space",
      activityLevel: 0,
      breakdown: {},
      insight: "",
      dateSeed: Math.floor(Date.now() / 86400000),
      projectCounts: {},
      groupCounts: {},
      totalProjects: 0,
      totalGroups: 0,
      calculatedAt: new Date().toISOString(),
      fallback: true,
    });
  }
}
