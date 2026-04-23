# Workflow Migration Guide

장시간 AI 파이프라인을 비동기 잡으로 분리하는 가이드.

## 배경

Vercel Serverless Function 기본 제한: 10s (Hobby) / 60s (Pro) / 800s (Enterprise).
AI synthesis / weekly digest / venture plan 등은 60s 를 초과할 수 있으므로,
동기 응답을 202 + jobId 로 분리하고 백그라운드 처리로 이관한다.

## 아키텍처

```
Client                    API                         DB                   Cron Processor
  │  POST /api/...         ├─ enqueue(job)  ──────►  workflow_jobs         
  │ ◄── 202 { jobId }      │                         (pending)              
  │                        │                                                 │
  │  GET /workflow/        ├─ fetchJob    ◄────────  workflow_jobs          │
  │  status/[jobId]        │                                                 │
  │  (poll every 3~5s)     │                                                 │
  │                                                                          │ */5 min
  │                                                  workflow_jobs   ◄──────┤ claim
  │                                                  (running)               │
  │                                                                          │
  │                                                  processor 실행          │
  │                                                                          │
  │                                                  workflow_jobs   ◄──────┤ complete
  │ ◄── final output      ◄──────────────────────   (completed)              │
```

## 사용 예 (wiki-synthesis 이식)

**Before**: POST /api/ai/wiki-synthesis — 60s+ 동기 실행, 503 타임아웃 위험

**After**:

```ts
// 1) app/api/ai/wiki-synthesis/trigger/route.ts
import { enqueue } from "@/lib/workflow/queue";

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { groupId } = await req.json();

  const result = await enqueue(supabase, {
    taskType: "wiki-synthesis",
    input: { groupId },
    userId: user.id,
    groupId,
  });
  if ("error" in result) return NextResponse.json(result, { status: 500 });
  return NextResponse.json({ jobId: result.jobId, status: "pending" }, { status: 202 });
}

// 2) app/api/cron/process-jobs/route.ts — PROCESSORS 에 등록
import { runWikiSynthesis } from "@/lib/ai/wiki-synthesis-core";

const PROCESSORS = {
  "wiki-synthesis": async (job) => {
    return await runWikiSynthesis(job.input.groupId, job.created_by);
  },
};

// 3) 클라이언트 — 폴링
async function pollJob(jobId: string) {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`/api/workflow/status/${jobId}`);
    const j = await res.json();
    if (j.status === "completed") return j.output;
    if (j.status === "failed") throw new Error(j.error);
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error("timeout");
}
```

## 이식 후보 route

| Route | 실행 시간 | 우선순위 |
|-------|---------|---------|
| `/api/ai/wiki-synthesis` | 30~60s | P0 |
| `/api/ai/weekly-digest` | 20~40s | P1 |
| `/api/ai/meeting-summary` (audio) | 10~30s | P2 |
| `/api/ai/group-plan` | <10s | skip |

## Vercel Workflow 정식 이전

Vercel Workflow 가 안정 출시되면 `lib/workflow/queue.ts` 구현만 `@vercel/workflow`
기반으로 교체. API 시그니처는 동일하게 유지.

## 현재 상태

- [x] `workflow_jobs` 테이블 (migration 061)
- [x] `lib/workflow/queue.ts` — enqueue/fetch/claim/complete/fail
- [x] `/api/workflow/status/[jobId]` — 폴링 엔드포인트
- [x] `/api/cron/process-jobs` — 5분 크론 프로세서 (스켈레톤)
- [ ] wiki-synthesis 실제 이식 (다음 pass)
- [ ] weekly-digest 이식
- [ ] 클라이언트 폴링 훅 `useWorkflowJob(jobId)`
