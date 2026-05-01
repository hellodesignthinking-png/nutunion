/**
 * POST /api/chat/rooms/[id]/attachments
 *
 * 입력: JSON
 * {
 *   url: string,           // 클라이언트가 Supabase Storage 에 이미 업로드한 publicUrl
 *   name: string,
 *   mime: string,
 *   size: number
 * }
 *
 * Vercel serverless 4.5MB 바디 제한 회피 — 클라이언트가 먼저 Storage 에 올리고
 * 여기서는 URL 만 받아서 자동 인덱싱 (자료실/회의록) + 메시지 기록.
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
// [Drive migration Phase 3a] content now stored on R2 — drive-mirror import removed
// import { mirrorToDrive, getGroupResourcesFolder, getProjectStageFolder } from "@/lib/google/drive-mirror";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
type Ctx = { params: Promise<{ id: string }> };

/** service_role 클라이언트 (RLS 우회) — chat_rooms 재귀 버그 회피용 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export const POST = withRouteLog("chat.rooms.id.attachments", async (req: NextRequest, { params }: Ctx) => {
  const { id: roomId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 1) JSON body
  const body = await req.json().catch(() => null);
  if (!body?.url) return NextResponse.json({ error: "url required" }, { status: 400 });
  const publicUrl: string = body.url;
  const fileName: string = body.name || publicUrl.split("/").pop() || "file";
  const mime: string = body.mime || "application/octet-stream";
  const fileSize: number = Number(body.size) || 0;
  const storageType: "r2" | "supabase" | "google_drive" | "external" =
    ["r2", "supabase", "google_drive", "external"].includes(body.storage_type)
      ? body.storage_type
      : "supabase";
  const storageKey: string | null = body.storage_key || null;

  // 2) 방 컨텍스트 — RLS 재귀 버그 회피 위해 service_role 시도 (폴백은 일반 client)
  const admin = getAdminClient();
  let room: any = null;
  let roomErr: any = null;
  if (admin) {
    const r = await admin
      .from("chat_rooms")
      .select("type, group_id, project_id")
      .eq("id", roomId)
      .maybeSingle();
    room = r.data;
    roomErr = r.error;
  } else {
    const r = await supabase
      .from("chat_rooms")
      .select("type, group_id, project_id")
      .eq("id", roomId)
      .maybeSingle();
    room = r.data;
    roomErr = r.error;
  }
  if (roomErr) {
    console.error("[chat attachment] room lookup failed", roomErr);
    return NextResponse.json(
      {
        error: `방 조회 실패: ${roomErr.message}`,
        hint: "Supabase RLS 재귀 이슈 가능 — is_chat_member 를 SECURITY DEFINER 로 재생성 필요",
      },
      { status: 500 },
    );
  }
  if (!room) return NextResponse.json({ error: "room not found" }, { status: 404 });

  const isImage = mime.startsWith("image/");
  const isAudio = mime.startsWith("audio/") || mime === "video/webm" || mime === "video/mp4";

  // RLS 우회용 db 클라이언트 — 자료실/회의록 insert 권한 확보
  const db = admin || supabase;

  // 3) 자동 인덱싱 — 이미지/파일/녹음 모두 자료실 등록 + 녹음은 회의록도 추가
  let autoIndexedAs: "file_attachment" | "meeting_note" | null = null;
  let linkedResourceId: string | null = null;
  let meetingId: string | null = null;

  // (A) 모든 파일 → 자료실 등록 (녹음 포함)
  {
    const detectedType = isImage
      ? "image"
      : isAudio ? "audio"
      : /pdf$/i.test(mime) ? "pdf"
      : /presentation|powerpoint|ppt/i.test(mime) ? "slide"
      : /spreadsheet|excel|csv/i.test(mime) ? "sheet"
      : /word|document/i.test(mime) ? "doc"
      : "file";

    // 볼트 방 → project_resources
    if (room.project_id) {
      try {
        const prInsert: any = {
          project_id: room.project_id,
          name: fileName,
          url: publicUrl,
          type: detectedType,
          stage: "evidence",
          uploaded_by: auth.user.id,
          storage_type: storageType,
          storage_key: storageKey,
        };
        let { data: pr, error: prErr } = await db
          .from("project_resources")
          .insert(prInsert)
          .select("id")
          .maybeSingle();
        if (prErr && /storage_type|storage_key/.test(prErr.message)) {
          delete prInsert.storage_type;
          delete prInsert.storage_key;
          ({ data: pr } = await db.from("project_resources").insert(prInsert).select("id").maybeSingle());
        }
        if (pr?.id) {
          autoIndexedAs = "file_attachment";
          linkedResourceId = pr.id;
        } else if (prErr) {
          console.warn("[chat attachment] project_resources insert error", prErr);
        }
      } catch (err) {
    log.error(err, "chat.rooms.id.attachments.failed");
        console.warn("[chat attachment] project_resources insert failed", err);
      }
    }

    // 너트 방 또는 project_resources 실패 시 → file_attachments
    if (!linkedResourceId) {
      const target_type = room.project_id ? "project" : room.group_id ? "group" : null;
      const target_id = room.project_id || room.group_id || null;
      if (target_type && target_id) {
        try {
          const faInsert: any = {
            target_type,
            target_id,
            uploaded_by: auth.user.id,
            file_name: fileName,
            file_url: publicUrl,
            file_size: fileSize,
            file_type: mime,
            storage_type: storageType,
            storage_key: storageKey,
          };
          let { data: fa, error: faErr } = await db
            .from("file_attachments")
            .insert(faInsert)
            .select("id")
            .maybeSingle();
          if (faErr && /storage_type|storage_key/.test(faErr.message)) {
            delete faInsert.storage_type;
            delete faInsert.storage_key;
            ({ data: fa } = await db.from("file_attachments").insert(faInsert).select("id").maybeSingle());
          }
          if (fa?.id) {
            autoIndexedAs = "file_attachment";
            linkedResourceId = fa.id;
          } else if (faErr) {
            console.warn("[chat attachment] file_attachments insert error", faErr);
          }
        } catch (err) {
    log.error(err, "chat.rooms.id.attachments.failed");
          console.warn("[chat attachment] file_attachments insert failed", err);
        }
      }
    }
  }

  // (B) 녹음이면 회의록도 추가 (A에서 이미 자료실 등록된 상태)
  if (isAudio) {
    // 녹음 → 회의 + AI 요약 background
    const meetingPayload: any = {
      title: `채팅 녹음 — ${new Date().toLocaleString("ko-KR", {
        month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
      })}`,
      scheduled_at: new Date().toISOString(),
      status: "completed",
      created_by: auth.user.id,
    };
    if (room.project_id) meetingPayload.project_id = room.project_id;
    if (room.group_id) meetingPayload.group_id = room.group_id;

    try {
      const { data: meeting, error: meetingErr } = await db
        .from("meetings")
        .insert(meetingPayload)
        .select("id")
        .maybeSingle();
      if (meetingErr) {
        console.warn("[chat attachment] meeting insert error", meetingErr);
      }
      if (meeting?.id) {
        meetingId = meeting.id;
        autoIndexedAs = "meeting_note";  // 회의록 우선 표시 (자료실도 이미 됐음)
        linkedResourceId = meeting.id;

        const origin = req.headers.get("origin") || new URL(req.url).origin;
        fetch(`${origin}/api/ai/meeting-summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") || "" },
          body: JSON.stringify({
            meetingTitle: meetingPayload.title,
            audioUrl: publicUrl,
            audioMimeType: mime,
            notes: null,
            agendas: [],
          }),
        })
          .then(async (r) => {
            if (!r.ok) return;
            const result = await r.json();
            if (result.summary) {
              await db.from("meetings").update({ summary: result.summary }).eq("id", meeting.id);
            }
            if (result.discussions?.length || result.decisions?.length) {
              const notes: any[] = [];
              result.discussions?.forEach((d: string) =>
                notes.push({ meeting_id: meeting.id, content: d, type: "note", created_by: auth.user.id }),
              );
              result.decisions?.forEach((d: string) =>
                notes.push({ meeting_id: meeting.id, content: d, type: "decision", created_by: auth.user.id }),
              );
              result.actionItems?.forEach((a: { task: string }) =>
                notes.push({ meeting_id: meeting.id, content: a.task, type: "action_item", created_by: auth.user.id }),
              );
              if (notes.length) await db.from("meeting_notes").insert(notes);
            }
          })
          .catch((e) => console.warn("[chat attachment] meeting-summary bg failed", e));
      }
    } catch (err) {
    log.error(err, "chat.rooms.id.attachments.failed");
      console.warn("[chat attachment] meetings insert failed", err);
    }
  }

  // 4) 메시지 기록 — 스키마 캐시 fallback 포함
  const full: any = {
    room_id: roomId,
    sender_id: auth.user.id,
    content: null,
    attachment_url: publicUrl,
    attachment_type: isImage ? "image" : isAudio ? "audio" : "file",
    attachment_name: fileName,
    attachment_size: fileSize,
    auto_indexed_as: autoIndexedAs,
    linked_resource_id: linkedResourceId,
    storage_type: storageType,
  };
  let msgRes = await db
    .from("chat_messages")
    .insert(full)
    .select(
      "id, room_id, sender_id, content, attachment_url, attachment_type, attachment_name, attachment_size, auto_indexed_as, linked_resource_id, created_at, sender:profiles!chat_messages_sender_id_fkey(id, nickname, avatar_url)",
    )
    .single();

  // Step 2 — 컬럼 누락 fallback
  if (
    msgRes.error &&
    /attachment_name|attachment_size|auto_indexed_as|linked_resource_id|storage_type/i.test(msgRes.error.message)
  ) {
    console.warn("[chat attachment] fallback step 2", msgRes.error.message);
    msgRes = await db
      .from("chat_messages")
      .insert({
        room_id: roomId,
        sender_id: auth.user.id,
        content: null,
        attachment_url: publicUrl,
        attachment_type: full.attachment_type,
      })
      .select(
        "id, room_id, sender_id, content, attachment_url, attachment_type, created_at, sender:profiles!chat_messages_sender_id_fkey(id, nickname, avatar_url)",
      )
      .single();
  }

  // Step 3 — 더 심한 fallback: content 에 이모지 링크만 넣고 attachment 제거
  if (msgRes.error) {
    console.warn("[chat attachment] fallback step 3", msgRes.error.message);
    const emoji = isImage ? "📷" : isAudio ? "🎙️" : "📎";
    msgRes = await db
      .from("chat_messages")
      .insert({
        room_id: roomId,
        sender_id: auth.user.id,
        content: `${emoji} ${fileName}\n${publicUrl}`,
      })
      .select(
        "id, room_id, sender_id, content, created_at, sender:profiles!chat_messages_sender_id_fkey(id, nickname, avatar_url)",
      )
      .single();
  }

  if (msgRes.error) {
    console.error("[chat attachment] message insert 최종 실패", msgRes.error);
    return NextResponse.json(
      {
        error: msgRes.error.message,
        code: msgRes.error.code,
        details: (msgRes.error as any).details,
        hint:
          "chat_messages 테이블에 레거시 CHECK/NOT NULL 제약이 있을 수 있습니다. Supabase SQL Editor 에서 다음 실행: " +
          "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.chat_messages'::regclass and contype = 'c';",
      },
      { status: 500 },
    );
  }

  // [Drive migration Phase 3a] content now stored on R2 — Drive 자동 미러링 제거.
  // R2 가 canonical. 과거 Drive 데이터는 별도 admin 마이그레이션 도구로 이관 예정.

  return NextResponse.json({
    message: msgRes.data,
    indexed: autoIndexedAs,
    linked_resource_id: linkedResourceId,
  });
});
