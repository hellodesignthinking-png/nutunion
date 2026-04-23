import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

// 카카오톡 대화 기반 회의정리 페이지 → 볼트 회의록 탭으로 통합
// chat-digest 기능은 제거되고 ProjectMeetings 컴포넌트로 통일
export default async function ProjectDigestsPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/projects/${id}?tab=meetings`);
}
