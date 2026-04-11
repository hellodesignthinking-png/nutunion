"use server";

import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_CONTENT } from "@/lib/template-content";

export type ProjectTemplateId = "local-branding" | "platform-mvp" | "popup-store";

/**
 * Seeds a project with template-specific milestones, resources, and meetings.
 * Each section is individually wrapped in try/catch so partial seeding succeeds.
 */
export async function seedProjectTemplate(
  projectId: string,
  templateId: ProjectTemplateId,
  leadId: string
) {
  const supabase = await createClient();

  try {
    if (templateId === "local-branding") {
      await seedLocalBrandingTemplate(supabase, projectId, leadId);
    } else if (templateId === "platform-mvp") {
      await seedPlatformMvpTemplate(supabase, projectId, leadId);
    } else if (templateId === "popup-store") {
      await seedPopupStoreTemplate(supabase, projectId, leadId);
    }
  } catch (error) {
    // Log but don't throw — partial seeding is better than failing the whole project creation
    console.error(`Error seeding project template ${templateId}:`, error);
  }
}

/* ------------------------------------------------------------------ */
/*  Helper: seed meetings for a project                                */
/* ------------------------------------------------------------------ */

function getNextMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const nextMonday = new Date(d.setDate(diff));
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}

async function seedProjectMeetings(
  supabase: any,
  projectId: string,
  leadId: string,
  meetings: { title: string; weekOffset: number; hour: number; duration: number }[]
) {
  try {
    const nextMonday = getNextMonday(new Date());

    for (const m of meetings) {
      const scheduledAt = new Date(nextMonday);
      scheduledAt.setDate(scheduledAt.getDate() + m.weekOffset * 7);
      scheduledAt.setHours(m.hour, 0, 0, 0);

      await supabase.from("meetings").insert({
        project_id: projectId,
        title: m.title,
        description: m.title,
        scheduled_at: scheduledAt.toISOString(),
        duration_min: m.duration,
        organizer_id: leadId,
        status: "upcoming",
      });
    }
  } catch (err) {
    console.warn("Project meetings seeding failed:", err);
  }
}

/* ------------------------------------------------------------------ */
/*  Local Branding template                                            */
/* ------------------------------------------------------------------ */

async function seedLocalBrandingTemplate(
  supabase: any,
  projectId: string,
  leadId: string
) {
  // Milestones
  try {
    const milestones = [
      { title: "시장조사 & 컨셉 기획", description: "시장조사와 브랜드 컨셉 기획", status: "in_progress", sort_order: 0 },
      { title: "로고 & 아이덴티티 디자인", description: "로고 및 아이덴티티 시스템 디자인", status: "pending", sort_order: 1 },
      { title: "공간 연출 & 제작", description: "공간 연출 및 제작", status: "pending", sort_order: 2 },
      { title: "런칭 & 홍보", description: "런칭 및 홍보 활동", status: "pending", sort_order: 3 },
    ];
    for (const ms of milestones) {
      await supabase.from("project_milestones").insert({ project_id: projectId, ...ms, due_date: null });
    }
  } catch (err) { console.warn("Local branding milestones seeding failed:", err); }

  // Resources
  try {
    const resources = [
      { name: "브랜드 가이드라인 양식", type: "template", stage: "planning", url: "/templates/brand-guideline", content: TEMPLATE_CONTENT["brand-guideline"] },
      { name: "경쟁사 분석 시트", type: "template", stage: "planning", url: "/templates/competitor-sheet", content: TEMPLATE_CONTENT["competitor-sheet"] },
    ];
    for (const r of resources) {
      await supabase.from("project_resources").insert({ project_id: projectId, ...r, uploaded_by: leadId });
    }
  } catch (err) { console.warn("Local branding resources seeding failed:", err); }

  // Meetings
  await seedProjectMeetings(supabase, projectId, leadId, [
    { title: "킥오프 미팅", weekOffset: 0, hour: 14, duration: 90 },
    { title: "컨셉 리뷰", weekOffset: 2, hour: 14, duration: 60 },
    { title: "디자인 검토", weekOffset: 4, hour: 14, duration: 60 },
    { title: "런칭 준비 회의", weekOffset: 6, hour: 14, duration: 90 },
  ]);
}

/* ------------------------------------------------------------------ */
/*  Platform MVP template                                              */
/* ------------------------------------------------------------------ */

async function seedPlatformMvpTemplate(
  supabase: any,
  projectId: string,
  leadId: string
) {
  // Milestones
  try {
    const milestones = [
      { title: "요구사항 정의 & 기획", description: "요구사항 정의 및 기획", status: "in_progress", sort_order: 0 },
      { title: "DB 설계 & API 개발", description: "데이터베이스 설계 및 API 개발", status: "pending", sort_order: 1 },
      { title: "프론트엔드 개발", description: "프론트엔드 개발", status: "pending", sort_order: 2 },
      { title: "QA & 런칭", description: "품질 보증 및 런칭", status: "pending", sort_order: 3 },
    ];
    for (const ms of milestones) {
      await supabase.from("project_milestones").insert({ project_id: projectId, ...ms, due_date: null });
    }
  } catch (err) { console.warn("Platform MVP milestones seeding failed:", err); }

  // Resources
  try {
    const resources = [
      { name: "기능 명세서 양식", type: "template", stage: "planning", url: "/templates/spec-sheet", content: TEMPLATE_CONTENT["spec-sheet"] },
      { name: "기술 스택 문서", type: "template", stage: "planning", url: "/templates/tech-stack", content: TEMPLATE_CONTENT["tech-stack"] },
    ];
    for (const r of resources) {
      await supabase.from("project_resources").insert({ project_id: projectId, ...r, uploaded_by: leadId });
    }
  } catch (err) { console.warn("Platform MVP resources seeding failed:", err); }

  // Meetings
  await seedProjectMeetings(supabase, projectId, leadId, [
    { title: "킥오프 & 요구사항 정리", weekOffset: 0, hour: 10, duration: 120 },
    { title: "스프린트 1 리뷰", weekOffset: 2, hour: 10, duration: 60 },
    { title: "스프린트 2 리뷰", weekOffset: 4, hour: 10, duration: 60 },
    { title: "QA 및 런칭 회의", weekOffset: 6, hour: 10, duration: 90 },
  ]);
}

/* ------------------------------------------------------------------ */
/*  Pop-up Store template                                              */
/* ------------------------------------------------------------------ */

async function seedPopupStoreTemplate(
  supabase: any,
  projectId: string,
  leadId: string
) {
  // Milestones
  try {
    const milestones = [
      { title: "공간 섭외 & 기획", description: "공간 섭외 및 기획", status: "in_progress", sort_order: 0 },
      { title: "비주얼 가이드 제작", description: "비주얼 가이드 제작", status: "pending", sort_order: 1 },
      { title: "스태프 교육 & 준비", description: "스태프 교육 및 준비", status: "pending", sort_order: 2 },
      { title: "운영 & 정산", description: "운영 및 정산", status: "pending", sort_order: 3 },
    ];
    for (const ms of milestones) {
      await supabase.from("project_milestones").insert({ project_id: projectId, ...ms, due_date: null });
    }
  } catch (err) { console.warn("Pop-up store milestones seeding failed:", err); }

  // Resources
  try {
    const resources = [
      { name: "비용 정산 시트", type: "template", stage: "planning", url: "/templates/cost-settlement", content: TEMPLATE_CONTENT["cost-settlement"] },
      { name: "운영 매뉴얼", type: "template", stage: "planning", url: "/templates/operations-manual", content: TEMPLATE_CONTENT["operations-manual"] },
    ];
    for (const r of resources) {
      await supabase.from("project_resources").insert({ project_id: projectId, ...r, uploaded_by: leadId });
    }
  } catch (err) { console.warn("Pop-up store resources seeding failed:", err); }

  // Meetings
  await seedProjectMeetings(supabase, projectId, leadId, [
    { title: "공간 답사 & 기획 회의", weekOffset: 0, hour: 14, duration: 120 },
    { title: "비주얼 컨셉 리뷰", weekOffset: 2, hour: 14, duration: 60 },
    { title: "스태프 교육 & 리허설", weekOffset: 3, hour: 14, duration: 90 },
    { title: "운영 정산 회의", weekOffset: 5, hour: 14, duration: 60 },
  ]);
}
