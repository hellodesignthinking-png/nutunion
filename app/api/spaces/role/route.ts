import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { getSpaceRole, getPermissions } from "@/lib/spaces/permissions";

/**
 * GET /api/spaces/role?owner_type=&owner_id=
 *   → { role, permissions }
 *
 * 클라이언트가 UI 가드용으로 호출. 사용자의 너트/볼트 역할 + capability 매트릭스.
 */
export const GET = withRouteLog("spaces.role", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ownerType = searchParams.get("owner_type");
  const ownerId = searchParams.get("owner_id");
  if ((ownerType !== "nut" && ownerType !== "bolt") || !ownerId) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const role = await getSpaceRole(supabase, user.id, ownerType, ownerId);
  if (!role) {
    return NextResponse.json({ role: null, permissions: null });
  }
  return NextResponse.json({
    role,
    permissions: getPermissions(role),
  });
});
