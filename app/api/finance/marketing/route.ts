import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const CONTENT_TEMPLATES: Record<string, { label: string; systemPrefix: string; instructionFormat: string }> = {
  blog: {
    label: "블로그 포스트",
    systemPrefix: "당신은 전문 블로그 작가입니다. SEO를 고려한 구체적이고 독자 친화적인 글을 작성합니다.",
    instructionFormat: "제목, 도입부, 본문(3~4개 소제목), 결론, 핵심 키워드 5개를 포함한 블로그 포스트를 작성해주세요. 마크다운 형식으로 작성하되 최소 800자 이상.",
  },
  sns: {
    label: "SNS 포스트",
    systemPrefix: "당신은 SNS 마케팅 전문가입니다. 짧지만 강렬한 메시지로 참여를 유도합니다.",
    instructionFormat: "인스타그램/페이스북용 포스트를 작성해주세요. 형식:\n1. 훅(Hook) 문구 (눈길을 사로잡는 첫 줄)\n2. 본문 (2~3문단)\n3. CTA (행동 유도)\n4. 해시태그 10개 (#태그 형식)\n\n이모지 적절히 활용.",
  },
  newsletter: {
    label: "뉴스레터",
    systemPrefix: "당신은 이메일 마케팅 전문가입니다. 고객이 읽고 싶어지는 뉴스레터를 작성합니다.",
    instructionFormat: "이메일 뉴스레터를 작성해주세요. 형식:\n- 제목 (Subject Line, 클릭률 높게)\n- 미리보기 텍스트\n- 인사말\n- 본문 (핵심 메시지 3가지)\n- CTA 버튼 문구\n- 발신자 서명",
  },
  ad: {
    label: "광고 카피",
    systemPrefix: "당신은 퍼포먼스 마케팅 카피라이터입니다. 전환율 높은 광고 문구를 작성합니다.",
    instructionFormat: "광고 캠페인에 사용할 카피를 작성해주세요:\n1. 메인 헤드라인 (30자 이내) - 3가지 버전\n2. 서브 헤드라인 - 3가지 버전\n3. 디스크립션 (90자 이내) - 3가지 버전\n4. CTA 버튼 문구 - 5가지 옵션",
  },
  press: {
    label: "보도자료",
    systemPrefix: "당신은 기업 홍보 전문가입니다. 언론에 배포할 수 있는 공식 보도자료를 작성합니다.",
    instructionFormat: "보도자료를 공식 형식으로 작성해주세요:\n[보도자료]\n- 제목\n- 부제\n- 리드 문단 (5W1H 요약)\n- 본문 (3~4문단)\n- 인용구 (경영진 코멘트)\n- 회사 소개\n- 연락처 (문의: [담당자명, 이메일])",
  },
  campaign: {
    label: "캠페인 기획",
    systemPrefix: "당신은 마케팅 전략가입니다. 실행 가능한 캠페인 기획안을 작성합니다.",
    instructionFormat: "마케팅 캠페인 기획안을 작성해주세요:\n1. 캠페인명\n2. 목표 (정량적 KPI)\n3. 타겟 고객\n4. 핵심 메시지\n5. 채널별 전략 (SNS, 이메일, 광고, 콘텐츠)\n6. 4주 단위 실행 일정\n7. 예상 예산 범위\n8. 성공 지표",
  },
};

export async function POST(req: NextRequest) {
  try {
    // 권한 체크
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { contentType, topic, tone, target, entityType, entityId } = body || {};

    if (!contentType || !topic || !entityType || !entityId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const template = CONTENT_TEMPLATES[contentType];
    if (!template) {
      return NextResponse.json({ error: `Invalid contentType: ${contentType}` }, { status: 400 });
    }

    // 엔티티 컨텍스트 — 볼트(프로젝트) 또는 법인
    let contextLines: string[] = [];

    if (entityType === "bolt") {
      const { data: project } = await supabase.from("projects").select("*").eq("id", entityId).single();
      if (!project) {
        return NextResponse.json({ error: "Bolt not found" }, { status: 404 });
      }
      contextLines = [
        `볼트명: ${project.title}`,
        project.description && `설명: ${project.description}`,
        project.category && `분야: ${project.category}`,
        project.start_date && `시작일: ${project.start_date}`,
        project.end_date && `종료일: ${project.end_date}`,
      ].filter(Boolean) as string[];
    } else if (entityType === "company") {
      const { data: company } = await supabase.from("companies").select("*").eq("id", entityId).single();
      if (!company) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 });
      }
      contextLines = [
        `회사명: ${company.name}`,
        company.label && `영문/설명: ${company.label}`,
        company.biz_type && `업종: ${company.biz_type}`,
        company.representative && `대표자: ${company.representative}`,
        company.address && `주소: ${company.address}`,
      ].filter(Boolean) as string[];
    }

    const system = `${template.systemPrefix}

[${entityType === "bolt" ? "볼트 정보" : "회사 정보"}]
${contextLines.join("\n")}

${tone ? `[톤앤매너] ${tone}` : ""}
${target ? `[타겟 고객] ${target}` : ""}

한국어로 작성하며, 대상의 특성과 목적을 반영해 신뢰감 있고 전문적인 콘텐츠를 만드세요.`;

    const prompt = `[콘텐츠 주제]
${topic}

[요청사항]
${template.instructionFormat}`;

    const { text } = await generateText({
      model: "anthropic/claude-sonnet-4.5",
      system,
      prompt,
      maxOutputTokens: 2000,
    });

    return NextResponse.json({
      success: true,
      contentType,
      contentTypeLabel: template.label,
      content: text,
      entityType,
      entityId,
      topic,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    console.error("[Marketing API]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
