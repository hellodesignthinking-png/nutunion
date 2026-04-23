import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAlimtalk, type AlimtalkTemplate } from "@/lib/alimtalk/send";

/**
 * POST /api/alimtalk/send
 * 서비스 내부 호출용 — admin / service_role 만.
 * Body: { userId?, phone?, template, variables }
 *   - userId 있으면 profiles.phone 자동 조회
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, phone: phoneIn, template, variables } = body as {
    userId?: string; phone?: string; template: AlimtalkTemplate; variables: Record<string, string>;
  };

  let phone = phoneIn;
  if (!phone && userId) {
    const { data: p } = await supabase.from("profiles").select("phone").eq("id", userId).maybeSingle();
    phone = (p as any)?.phone;
  }
  if (!phone) return NextResponse.json({ error: "phone or userId with phone required" }, { status: 400 });

  const result = await sendAlimtalk({ userId, phone, template, variables: variables || {} });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
