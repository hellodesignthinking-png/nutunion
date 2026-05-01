import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { z } from "zod";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { getGoogleClient, getCurrentUserId } from "@/lib/google/auth";
import { asGoogleErr } from "@/lib/google/error-helpers";

export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({
  files: z.array(z.object({
    id: z.string(),
    name: z.string(),
    mimeType: z.string(),
    webViewLink: z.string().url(),
    modifiedTime: z.string().optional(),
    ownerName: z.string().optional(),
  })).min(1).max(20),
});

function kindFromMime(mime: string): "drive_doc" | "pdf" | "link" {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("document") || mime.includes("spreadsheet") || mime.includes("presentation")) return "drive_doc";
  return "link";
}

/**
 * POST /api/venture/[projectId]/sources/import-drive
 *
 * 선택된 Drive 파일들을 venture_sources 로 일괄 import.
 * Google Docs 인 경우 본문을 pull 해서 content_text 에 저장 (최대 10KB, 향후 AI 요약 용도).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 멤버십
  const { data: pm } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
  if (!pm && !isAdminStaff) {
    return NextResponse.json({ error: "프로젝트 멤버만 import 가능" }, { status: 403 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 입력" }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  let docs: ReturnType<typeof google.docs> | null = null;
  try {
    if (userId) {
      const auth = await getGoogleClient(userId);
      docs = google.docs({ version: "v1", auth });
    }
  } catch {
    docs = null;
  }

  // 각 파일을 venture_source 로 변환
  const rows: Record<string, unknown>[] = [];
  for (const f of parsed.data.files) {
    const kind = kindFromMime(f.mimeType);
    let contentText: string | null = null;

    // Google Docs 인 경우 본문 pull 시도 (AI 요약 재료)
    if (docs && f.mimeType === "application/vnd.google-apps.document") {
      try {
        const docRes = await docs.documents.get({ documentId: f.id });
        const body = docRes.data.body?.content ?? [];
        const txt = body
          .map((block) => {
            const elements = block.paragraph?.elements ?? [];
            return elements.map((el) => el.textRun?.content ?? "").join("");
          })
          .join("")
          .trim();
        if (txt) contentText = txt.slice(0, 10_000);
      } catch (err) {
    log.error(err, "venture.projectId.sources.import-drive.failed");
        console.warn("[drive-import] docs fetch failed", f.id, asGoogleErr(err).message);
      }
    }

    rows.push({
      project_id: projectId,
      added_by: user.id,
      kind,
      title: f.name,
      url: f.webViewLink,
      content_text: contentText,
      author_name: f.ownerName ?? null,
      published_at: f.modifiedTime ?? null,
      summary_status: "pending",
      tags: [],
    });
  }

  const { data, error } = await supabase.from("venture_sources").insert(rows).select("id, title");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    imported: data?.length ?? 0,
    sources: data ?? [],
  });
}
