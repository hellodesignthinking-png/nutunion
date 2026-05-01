import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * GET  /api/spaces/favorites → { favorites: string[] }
 * POST body: { page_id, action: "add" | "remove" } → { favorites: string[] }
 */
export const GET = withRouteLog("spaces.favorites.get", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("favorite_pages")
    .eq("id", user.id)
    .maybeSingle();
  const favorites = Array.isArray(data?.favorite_pages) ? data!.favorite_pages : [];
  return NextResponse.json({ favorites });
});

export const POST = withRouteLog("spaces.favorites.post", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { page_id?: string; action?: "add" | "remove" } | null;
  if (!body?.page_id || (body.action !== "add" && body.action !== "remove")) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { data } = await supabase
    .from("profiles")
    .select("favorite_pages")
    .eq("id", user.id)
    .maybeSingle();
  const current = Array.isArray(data?.favorite_pages) ? (data!.favorite_pages as string[]) : [];
  let next: string[];
  if (body.action === "add") {
    next = current.includes(body.page_id) ? current : [...current, body.page_id];
  } else {
    next = current.filter((id) => id !== body.page_id);
  }
  if (next.length > 50) {
    return NextResponse.json({ error: "max_50_favorites" }, { status: 413 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ favorite_pages: next })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favorites: next });
});
