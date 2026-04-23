import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Schema = z.object({
  type: z.enum(["task", "event", "nut_activity", "bolt_activity", "journal"]),
  title: z.string().min(1).max(300),
  detail: z.string().max(4000).optional(),
  due_at: z.string().optional(),
  target_kind: z.enum(["personal", "group", "project"]),
  target_id: z.string().nullable().optional(),
});

function toDate(iso?: string): string | null {
  if (!iso) return null;
  // date-only YYYY-MM-DD passthrough, else slice ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function toIsoStart(iso?: string): string {
  if (!iso) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${iso}T09:00:00+09:00`;
  return new Date(iso).toISOString();
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad input", detail: parsed.error.message }, { status: 400 });
  }
  const { type, title, detail, due_at, target_kind, target_id } = parsed.data;

  try {
    // ──────────────────────────── task
    if (type === "task") {
      if (target_kind === "personal" || !target_id) {
        const { data, error } = await supabase.from("personal_tasks").insert({
          user_id: user.id,
          title,
          description: detail || null,
          due_date: toDate(due_at),
        }).select("id").single();
        if (error) throw error;
        return NextResponse.json({ ok: true, kind: "personal_task", id: (data as any).id });
      }
      if (target_kind === "project") {
        // find/create first milestone
        const { data: ms } = await supabase.from("project_milestones")
          .select("id").eq("project_id", target_id).order("sort_order").limit(1).maybeSingle();
        let milestoneId = (ms as any)?.id;
        if (!milestoneId) {
          const { data: newMs, error: msErr } = await supabase.from("project_milestones").insert({
            project_id: target_id, title: "기본 마일스톤", status: "in_progress", sort_order: 1,
          }).select("id").single();
          if (msErr) throw msErr;
          milestoneId = (newMs as any).id;
        }
        const { data, error } = await supabase.from("project_tasks").insert({
          milestone_id: milestoneId,
          title,
          status: "todo",
          assigned_to: user.id,
          due_date: toDate(due_at),
        }).select("id").single();
        if (error) throw error;
        return NextResponse.json({ ok: true, kind: "project_task", id: (data as any).id });
      }
      // task + group → graceful fallback to personal_task with group_id
      const { data, error } = await supabase.from("personal_tasks").insert({
        user_id: user.id,
        title,
        description: detail || null,
        due_date: toDate(due_at),
        group_id: target_id,
      }).select("id").single();
      if (error) throw error;
      return NextResponse.json({ ok: true, kind: "personal_task_linked_group", id: (data as any).id });
    }

    // ──────────────────────────── event
    if (type === "event") {
      const startIso = toIsoStart(due_at);
      if (target_kind === "group" && target_id) {
        const { data, error } = await supabase.from("events").insert({
          group_id: target_id,
          title,
          description: detail || null,
          start_at: startIso,
          created_by: user.id,
        }).select("id").single();
        if (error) throw error;
        return NextResponse.json({ ok: true, kind: "group_event", id: (data as any).id });
      }
      // personal / project event → personal_events (with optional project_id)
      const { data, error } = await supabase.from("personal_events").insert({
        user_id: user.id,
        title,
        description: detail || null,
        start_at: startIso,
        project_id: target_kind === "project" ? target_id : null,
      }).select("id").single();
      if (error) throw error;
      return NextResponse.json({ ok: true, kind: "personal_event", id: (data as any).id });
    }

    // ──────────────────────────── nut_activity → wiki draft
    if (type === "nut_activity") {
      if (target_kind !== "group" || !target_id) {
        // no target group → fall back to personal note
        const { data, error } = await supabase.from("personal_tasks").insert({
          user_id: user.id,
          title: `[메모] ${title}`,
          description: detail || null,
        }).select("id").single();
        if (error) throw error;
        return NextResponse.json({ ok: true, kind: "personal_note_fallback", id: (data as any).id });
      }
      // find/create "초안" topic in that group
      const { data: topicExist } = await supabase.from("wiki_topics")
        .select("id").eq("group_id", target_id).eq("name", "초안").maybeSingle();
      let topicId = (topicExist as any)?.id;
      if (!topicId) {
        const { data: newTopic, error: topicErr } = await supabase.from("wiki_topics").insert({
          group_id: target_id,
          name: "초안",
          description: "AI 비서를 통해 등록된 초안 글",
        }).select("id").single();
        if (topicErr) {
          // graceful fallback — user may lack wiki insert rights
          const { data: fallback, error: fErr } = await supabase.from("personal_tasks").insert({
            user_id: user.id,
            title: `[너트 초안] ${title}`,
            description: detail || null,
            group_id: target_id,
          }).select("id").single();
          if (fErr) throw fErr;
          return NextResponse.json({ ok: true, kind: "personal_note_fallback", id: (fallback as any).id, note: "위키 권한 없음 — 개인 메모로 저장" });
        }
        topicId = (newTopic as any).id;
      }
      const { data: page, error: pageErr } = await supabase.from("wiki_pages").insert({
        topic_id: topicId,
        title,
        content: detail || "",
        created_by: user.id,
        last_updated_by: user.id,
      }).select("id").single();
      if (pageErr) {
        const { data: fallback, error: fErr } = await supabase.from("personal_tasks").insert({
          user_id: user.id,
          title: `[너트 초안] ${title}`,
          description: detail || null,
          group_id: target_id,
        }).select("id").single();
        if (fErr) throw fErr;
        return NextResponse.json({ ok: true, kind: "personal_note_fallback", id: (fallback as any).id, note: pageErr.message });
      }
      return NextResponse.json({ ok: true, kind: "wiki_page", id: (page as any).id });
    }

    // ──────────────────────────── bolt_activity → project_tasks
    if (type === "bolt_activity") {
      if (target_kind !== "project" || !target_id) {
        // fallback personal
        const { data, error } = await supabase.from("personal_tasks").insert({
          user_id: user.id,
          title: `[볼트 아이디어] ${title}`,
          description: detail || null,
        }).select("id").single();
        if (error) throw error;
        return NextResponse.json({ ok: true, kind: "personal_note_fallback", id: (data as any).id });
      }
      const { data: ms } = await supabase.from("project_milestones")
        .select("id").eq("project_id", target_id).order("sort_order").limit(1).maybeSingle();
      let milestoneId = (ms as any)?.id;
      if (!milestoneId) {
        const { data: newMs, error: msErr } = await supabase.from("project_milestones").insert({
          project_id: target_id, title: "기본 마일스톤", status: "in_progress", sort_order: 1,
        }).select("id").single();
        if (msErr) throw msErr;
        milestoneId = (newMs as any).id;
      }
      const { data, error } = await supabase.from("project_tasks").insert({
        milestone_id: milestoneId,
        title,
        status: "todo",
        assigned_to: user.id,
        due_date: toDate(due_at),
      }).select("id").single();
      if (error) throw error;
      return NextResponse.json({ ok: true, kind: "project_task", id: (data as any).id });
    }

    // ──────────────────────────── journal → personal_tasks ([기록] prefix) — no personal_notes table
    if (type === "journal") {
      const { data, error } = await supabase.from("personal_tasks").insert({
        user_id: user.id,
        title: `[기록] ${title}`,
        description: detail || null,
        status: "done", // 기록이므로 완료 상태
      }).select("id").single();
      if (error) throw error;
      return NextResponse.json({ ok: true, kind: "journal_note", id: (data as any).id });
    }

    return NextResponse.json({ error: "unknown type" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "등록 실패" }, { status: 500 });
  }
}
