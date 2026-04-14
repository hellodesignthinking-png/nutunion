"use server";

import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_CONTENT } from "@/lib/template-content";

export type TemplateId = "sprint" | "paper-review" | "venture";

/**
 * Seeds a group with template-specific meetings, roadmap phases, and file attachments
 */
export async function seedGroupTemplate(
  groupId: string,
  templateId: TemplateId,
  hostId: string
) {
  const supabase = await createClient();

  // Verify the caller is the actual hostId
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== hostId) return;

  try {
    if (templateId === "sprint") {
      await seedSprintTemplate(supabase, groupId, hostId);
    } else if (templateId === "paper-review") {
      await seedPaperReviewTemplate(supabase, groupId, hostId);
    } else if (templateId === "venture") {
      await seedVentureTemplate(supabase, groupId, hostId);
    }
  } catch (error) {
    // Log but don't throw — partial seeding is better than failing the whole group creation
    console.error(`Error seeding template ${templateId}:`, error);
  }
}

/**
 * Sprint template: 6 weeks of weekly meetings with phases and resources
 */
async function seedSprintTemplate(supabase: any, groupId: string, hostId: string) {
  const now = new Date();
  const nextMonday = getNextMonday(now);

  // 6 meetings, weekly starting next Monday
  const meetings = [
    { title: "Sprint Week 1: 기획", agendas: ["기획", "진행", "검토"] },
    { title: "Sprint Week 2: 진행", agendas: ["기획", "진행", "검토"] },
    { title: "Sprint Week 3: 진행", agendas: ["기획", "진행", "검토"] },
    { title: "Sprint Week 4: 진행", agendas: ["기획", "진행", "검토"] },
    { title: "Sprint Week 5: 진행", agendas: ["기획", "진행", "검토"] },
    { title: "Sprint Week 6: 검토", agendas: ["기획", "진행", "검토"] },
  ];

  // Insert meetings
  try {
    for (let i = 0; i < meetings.length; i++) {
      const scheduledAt = new Date(nextMonday);
      scheduledAt.setDate(scheduledAt.getDate() + i * 7);
      scheduledAt.setHours(10, 0, 0, 0);

      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .insert({
          group_id: groupId,
          title: meetings[i].title,
          description: `${meetings[i].title} 회의`,
          scheduled_at: scheduledAt.toISOString(),
          duration_min: 90,
          organizer_id: hostId,
          status: "upcoming",
        })
        .select()
        .single();

      if (meetingError) { console.warn("Meeting insert failed:", meetingError.message); continue; }

      // Insert agendas for this meeting
      for (let j = 0; j < meetings[i].agendas.length; j++) {
        await supabase.from("meeting_agendas").insert({
          meeting_id: meeting.id,
          topic: meetings[i].agendas[j],
          description: `${meetings[i].agendas[j]} 진행`,
          duration_min: 30,
          sort_order: j,
        });
      }
    }
  } catch (err) { console.warn("Sprint meetings seeding failed:", err); }

  // 3 roadmap phases
  try {
    const phases = [
      { title: "기획 단계", order: 1, status: "active" },
      { title: "실행 단계", order: 2, status: "pending" },
      { title: "마무리 및 회고", order: 3, status: "pending" },
    ];

    for (const phase of phases) {
      await supabase.from("group_roadmap_phases").insert({
        group_id: groupId,
        title: phase.title,
        description: `${phase.title} 진행`,
        status: phase.status,
        order: phase.order,
      });
    }
  } catch (err) { console.warn("Sprint roadmap phases seeding failed:", err); }

  // 2 file attachments (template resources)
  try {
    const attachments = [
      {
        file_name: "Sprint 운영 가이드",
        file_url: "/templates/sprint-guide",
        file_type: "link",
        content: TEMPLATE_CONTENT["sprint-guide"],
      },
      {
        file_name: "회의록 양식",
        file_url: "/templates/meeting-notes",
        file_type: "link",
        content: TEMPLATE_CONTENT["meeting-notes"],
      },
    ];

    for (const attachment of attachments) {
      await supabase.from("file_attachments").insert({
        target_type: "group",
        target_id: groupId,
        file_name: attachment.file_name,
        file_url: attachment.file_url,
        file_type: attachment.file_type,
        content: attachment.content,
        uploaded_by: hostId,
      });
    }
  } catch (err) { console.warn("Sprint attachments seeding failed:", err); }
}

/**
 * Paper Review template: 4 weekly meetings with discussion phases
 */
async function seedPaperReviewTemplate(
  supabase: any,
  groupId: string,
  hostId: string
) {
  const now = new Date();
  const nextMonday = getNextMonday(now);

  const meetings = [
    { title: "Week 1: 논문 선정" },
    { title: "Week 2: 논문 리뷰 #1" },
    { title: "Week 3: 논문 리뷰 #2" },
    { title: "Week 4: 종합 토론" },
  ];

  // Insert meetings
  try {
    for (let i = 0; i < meetings.length; i++) {
      const scheduledAt = new Date(nextMonday);
      scheduledAt.setDate(scheduledAt.getDate() + i * 7);
      scheduledAt.setHours(19, 0, 0, 0);

      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .insert({
          group_id: groupId,
          title: meetings[i].title,
          description: meetings[i].title,
          scheduled_at: scheduledAt.toISOString(),
          duration_min: 120,
          organizer_id: hostId,
          status: "upcoming",
        })
        .select()
        .single();

      if (meetingError) { console.warn("Meeting insert failed:", meetingError.message); continue; }

      await supabase.from("meeting_agendas").insert({
        meeting_id: meeting.id,
        topic: "논문 리뷰 및 토론",
        description: "논문에 대한 깊이 있는 리뷰와 토론",
        duration_min: 120,
        sort_order: 0,
      });
    }
  } catch (err) { console.warn("Paper review meetings seeding failed:", err); }

  // 2 roadmap phases
  try {
    const phases = [
      { title: "논문 선정 & 배경 학습", order: 1, status: "active" },
      { title: "심화 리뷰 & 토론", order: 2, status: "pending" },
    ];

    for (const phase of phases) {
      await supabase.from("group_roadmap_phases").insert({
        group_id: groupId,
        title: phase.title,
        description: phase.title,
        status: phase.status,
        order: phase.order,
      });
    }
  } catch (err) { console.warn("Paper review phases seeding failed:", err); }

  // 1 file attachment
  try {
    await supabase.from("file_attachments").insert({
      target_type: "group",
      target_id: groupId,
      file_name: "논문 선정 가이드",
      file_url: "/templates/paper-selection-guide",
      file_type: "link",
      content: TEMPLATE_CONTENT["paper-selection-guide"],
      uploaded_by: hostId,
    });
  } catch (err) { console.warn("Paper review attachments seeding failed:", err); }
}

/**
 * Venture Building template: 4 biweekly meetings with building phases
 */
async function seedVentureTemplate(
  supabase: any,
  groupId: string,
  hostId: string
) {
  const now = new Date();
  const nextMonday = getNextMonday(now);

  const meetings = [
    { title: "아이디어 발굴 워크숍" },
    { title: "시장조사 발표" },
    { title: "MVP 검증" },
    { title: "피칭 데이" },
  ];

  // Insert meetings (biweekly)
  try {
    for (let i = 0; i < meetings.length; i++) {
      const scheduledAt = new Date(nextMonday);
      scheduledAt.setDate(scheduledAt.getDate() + i * 14);
      scheduledAt.setHours(14, 0, 0, 0);

      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .insert({
          group_id: groupId,
          title: meetings[i].title,
          description: meetings[i].title,
          scheduled_at: scheduledAt.toISOString(),
          duration_min: 180,
          organizer_id: hostId,
          status: "upcoming",
        })
        .select()
        .single();

      if (meetingError) { console.warn("Meeting insert failed:", meetingError.message); continue; }

      await supabase.from("meeting_agendas").insert({
        meeting_id: meeting.id,
        topic: meetings[i].title,
        description: meetings[i].title,
        duration_min: 180,
        sort_order: 0,
      });
    }
  } catch (err) { console.warn("Venture meetings seeding failed:", err); }

  // 3 roadmap phases
  try {
    const phases = [
      { title: "아이디어 발굴", order: 1, status: "active" },
      { title: "시장조사 & 검증", order: 2, status: "pending" },
      { title: "MVP 개발 & 피칭", order: 3, status: "pending" },
    ];

    for (const phase of phases) {
      await supabase.from("group_roadmap_phases").insert({
        group_id: groupId,
        title: phase.title,
        description: phase.title,
        status: phase.status,
        order: phase.order,
      });
    }
  } catch (err) { console.warn("Venture phases seeding failed:", err); }

  // 2 file attachments
  try {
    const attachments = [
      {
        file_name: "Business Model Canvas 양식",
        file_url: "/templates/business-model-canvas",
        file_type: "link",
        content: TEMPLATE_CONTENT["business-model-canvas"],
      },
      {
        file_name: "시장조사 체크리스트",
        file_url: "/templates/market-research",
        file_type: "link",
        content: TEMPLATE_CONTENT["market-research"],
      },
    ];

    for (const attachment of attachments) {
      await supabase.from("file_attachments").insert({
        target_type: "group",
        target_id: groupId,
        file_name: attachment.file_name,
        file_url: attachment.file_url,
        file_type: attachment.file_type,
        content: attachment.content,
        uploaded_by: hostId,
      });
    }
  } catch (err) { console.warn("Venture attachments seeding failed:", err); }
}

/**
 * Helper: Get the next Monday at 00:00
 */
function getNextMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  const nextMonday = new Date(d.setDate(diff));
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}
