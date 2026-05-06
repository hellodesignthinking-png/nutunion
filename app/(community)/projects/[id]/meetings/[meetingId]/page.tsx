import { redirect } from "next/navigation";

interface RouteContext {
  params: Promise<{ id: string; meetingId: string }>;
}

/**
 * /projects/{id}/meetings/{meetingId}
 *
 *   직접 페이지가 아닌, 볼트의 일정 탭으로 리다이렉트.
 *   ProjectMeetings 가 ?m= 파라미터를 보고 해당 미팅을 자동 확장.
 *   (calendar 위젯 / 글로벌 캘린더 / 통합 활동 피드의 deep-link 호환용)
 */
export default async function ProjectMeetingDetailPage({ params }: RouteContext) {
  const { id, meetingId } = await params;
  redirect(`/projects/${id}?tab=meetings&m=${meetingId}`);
}
