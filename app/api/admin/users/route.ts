import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// ── Helper: build admin client (requires SUPABASE_SERVICE_ROLE_KEY) ──
function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Auth guard: must be admin ───────────────────────────────────────
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? supabase : null;
}

// ── POST /api/admin/users — Create new user ─────────────────────────
export const POST = withRouteLog("admin.users.post", async (req: NextRequest) => {
  const supabase = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, password, nickname, name } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "이메일과 비밀번호가 필요합니다" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다" }, { status: 400 });
  }

  try {
    const admin = getAdminClient();

    // 1. Create auth user
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email verification
    });

    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Upsert profile (trigger should handle it, but be safe)
    await admin.from("profiles").upsert({
      id: userId,
      email,
      nickname: nickname?.trim() || email.split("@")[0],
      name: name?.trim() || nickname?.trim() || email.split("@")[0],
      role: "member",
      can_create_crew: false,
      grade: "bronze",
    }, { onConflict: "id" });

    return NextResponse.json({ success: true, userId });
  } catch (e: any) {
    log.error(e, "admin.users.failed");
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
});

// ── PATCH /api/admin/users — Update profile or reset password ───────
export const PATCH = withRouteLog("admin.users.patch", async (req: NextRequest) => {
  const supabase = await requireAdmin();
  if (!supabase) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { userId, action } = body;

  if (!userId) return NextResponse.json({ error: "userId 필요" }, { status: 400 });

  try {
    const admin = getAdminClient();

    // ── Action: change password ────────────────────────────────────
    if (action === "reset_password") {
      const { newPassword } = body;
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다" }, { status: 400 });
      }

      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    // ── Action: update profile info ────────────────────────────────
    if (action === "update_profile") {
      const { nickname, name, bio, email } = body;

      const profileUpdate: Record<string, any> = {};
      if (nickname !== undefined) profileUpdate.nickname = nickname.trim() || null;
      if (name !== undefined) profileUpdate.name = name.trim() || null;
      if (bio !== undefined) profileUpdate.bio = bio.trim() || null;

      // Update email in auth if changed
      if (email) {
        const { error: emailErr } = await admin.auth.admin.updateUserById(userId, { email });
        if (emailErr) return NextResponse.json({ error: emailErr.message }, { status: 400 });
        profileUpdate.email = email;
      }

      const { error } = await admin.from("profiles").update(profileUpdate).eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ── Action: delete user ────────────────────────────────────────
    if (action === "delete_user") {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
  } catch (e: any) {
    log.error(e, "admin.users.failed");
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
});
