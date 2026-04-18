"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type {
  VentureInsight, VentureProblem, VentureIdea,
  VenturePrototypeTask, VentureFeedback,
} from "@/lib/venture/types";

type Kind = "insight" | "problem" | "idea" | "prototype";

interface Props {
  stageId: string;
  title: string;
  description: string;
  projectId: string;
  kind: Kind;
  locked?: boolean;
  lockReason?: string;
  items:
    | VentureInsight[]
    | VentureProblem[]
    | VentureIdea[]
    | { tasks: VenturePrototypeTask[]; feedback: VentureFeedback[] };
  currentUserId?: string;
}

export function VentureStageSection(props: Props) {
  if (props.locked) return <LockedCard {...props} />;
  return (
    <section id={props.stageId} className="scroll-mt-20">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-[18px] sm:text-[20px] font-bold text-nu-ink">{props.title}</h2>
        <p className="text-[12px] text-nu-graphite">{props.description}</p>
      </div>
      {props.kind === "insight" && <InsightSection {...(props as Props & { items: VentureInsight[] })} />}
      {props.kind === "problem" && <ProblemSection {...(props as Props & { items: VentureProblem[] })} />}
      {props.kind === "idea" && <IdeaSection {...(props as Props & { items: VentureIdea[] })} />}
      {props.kind === "prototype" && (
        <PrototypeSection {...(props as Props & { items: { tasks: VenturePrototypeTask[]; feedback: VentureFeedback[] } })} />
      )}
    </section>
  );
}

function LockedCard({ stageId, title, lockReason }: Props) {
  return (
    <section id={stageId} className="border-[2px] border-dashed border-nu-ink/30 bg-nu-paper p-6 text-center">
      <div className="text-[32px] mb-1">🔒</div>
      <h3 className="font-bold text-[16px] text-nu-ink mb-1">{title}</h3>
      <p className="text-[12px] text-nu-graphite">{lockReason ?? "이전 단계를 먼저 완료해주세요"}</p>
    </section>
  );
}

// ── Empathize ────────────────────────────────────────────────────

function InsightSection({ items, projectId }: Props & { items: VentureInsight[] }) {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState("");
  const [painPoint, setPainPoint] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [source, setSource] = useState<VentureInsight["source"]>("interview");
  const router = useRouter();

  const submit = async () => {
    if (quote.trim().length < 5) return toast.error("인사이트는 5자 이상");
    const res = await fetch(`/api/venture/${projectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "insight", source, quote: quote.trim(),
        pain_point: painPoint.trim() || undefined,
        target_user: targetUser.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) return toast.error(data.error || "실패");
    toast.success("인사이트 추가됨");
    setQuote(""); setPainPoint(""); setTargetUser("");
    setOpen(false);
    router.refresh();
  };

  const del = async (id: string) => {
    if (!confirm("삭제?")) return;
    const res = await fetch(`/api/venture/${projectId}/actions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", entity: "insight", id }),
    });
    if (res.ok) router.refresh();
  };

  return (
    <div className="border-[2.5px] border-nu-ink bg-nu-paper">
      <div className="p-4 border-b-[2px] border-nu-ink flex justify-between items-center flex-wrap gap-2">
        <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
          총 {items.length}건
        </span>
        <button onClick={() => setOpen(!open)} className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-ink">
          {open ? "닫기" : "+ 인사이트 추가"}
        </button>
      </div>
      {open && (
        <div className="p-4 border-b-[2px] border-nu-ink bg-nu-ink/5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select value={source} onChange={(e) => setSource(e.target.value as VentureInsight["source"])} className="border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]">
            <option value="interview">인터뷰</option>
            <option value="observation">관찰</option>
            <option value="survey">설문</option>
            <option value="research">리서치</option>
            <option value="other">기타</option>
          </select>
          <input value={targetUser} onChange={(e) => setTargetUser(e.target.value)} placeholder="대상 (예: 신림동 1인 가구 직장인)" className="border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]" />
          <textarea value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="유저 발언 인용 그대로" rows={3} className="sm:col-span-2 border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]" />
          <input value={painPoint} onChange={(e) => setPainPoint(e.target.value)} placeholder="추출된 고통점 (선택)" className="sm:col-span-2 border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]" />
          <button onClick={submit} className="sm:col-span-2 border-[2.5px] border-nu-ink bg-nu-ink text-nu-paper py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-pink">저장</button>
        </div>
      )}
      {items.length === 0 ? (
        <p className="p-6 text-center text-[12px] text-nu-graphite">아직 인사이트가 없습니다.</p>
      ) : (
        <div className="divide-y divide-nu-ink/10">
          {items.map((i) => (
            <div key={i.id} className="p-4">
              <div className="flex gap-2 items-center mb-1.5 flex-wrap">
                <span className="font-mono-nu text-[9px] uppercase tracking-wider border border-nu-ink/30 px-1.5 py-0.5 text-nu-graphite">{i.source}</span>
                {i.target_user && <span className="text-[11px] text-nu-graphite">· {i.target_user}</span>}
                <button onClick={() => del(i.id)} className="ml-auto text-[10px] text-red-600 hover:underline">삭제</button>
              </div>
              <p className="text-[13px] text-nu-ink italic">&ldquo;{i.quote}&rdquo;</p>
              {i.pain_point && <p className="text-[12px] text-nu-pink mt-1.5 font-bold">→ {i.pain_point}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Define ───────────────────────────────────────────────────────

function ProblemSection({ items, projectId }: Props & { items: VentureProblem[] }) {
  const [open, setOpen] = useState(false);
  const [hmw, setHmw] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [context, setContext] = useState("");
  const [metric, setMetric] = useState("");
  const router = useRouter();

  const submit = async () => {
    if (hmw.trim().length < 10) return toast.error("HMW 문장은 10자 이상");
    const res = await fetch(`/api/venture/${projectId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "problem", hmw_statement: hmw.trim(),
        target_user: targetUser.trim() || undefined,
        context: context.trim() || undefined,
        success_metric: metric.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) return toast.error(data.error || "실패");
    setHmw(""); setTargetUser(""); setContext(""); setMetric("");
    setOpen(false);
    router.refresh();
  };

  const select = async (id: string) => {
    await fetch(`/api/venture/${projectId}/actions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "select_problem", problem_id: id }),
    });
    toast.success("HMW 선정됨");
    router.refresh();
  };

  return (
    <div className="border-[2.5px] border-nu-ink bg-nu-paper">
      <div className="p-4 border-b-[2px] border-nu-ink flex justify-between items-center">
        <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">총 {items.length}개 후보</span>
        <button onClick={() => setOpen(!open)} className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-ink">
          {open ? "닫기" : "+ HMW 추가"}
        </button>
      </div>
      {open && (
        <div className="p-4 border-b-[2px] border-nu-ink bg-nu-ink/5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <textarea value={hmw} onChange={(e) => setHmw(e.target.value)} placeholder="어떻게 하면 [대상]이 [상황]에서 [목표]할 수 있을까?" rows={2} className="sm:col-span-2 border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]" />
          <input value={targetUser} onChange={(e) => setTargetUser(e.target.value)} placeholder="타겟 유저" className="border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]" />
          <input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="성공 지표" className="border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]" />
          <input value={context} onChange={(e) => setContext(e.target.value)} placeholder="맥락 (선택)" className="sm:col-span-2 border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]" />
          <button onClick={submit} className="sm:col-span-2 border-[2.5px] border-nu-ink bg-nu-ink text-nu-paper py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-pink">저장</button>
        </div>
      )}
      <div className="divide-y divide-nu-ink/10">
        {items.length === 0 ? (
          <p className="p-6 text-center text-[12px] text-nu-graphite">HMW 후보 없음</p>
        ) : items.map((p) => (
          <div key={p.id} className={`p-4 ${p.is_selected ? "bg-nu-pink/10" : ""}`}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className={`text-[14px] ${p.is_selected ? "font-bold text-nu-ink" : "text-nu-ink"}`}>
                  {p.is_selected && "★ "}{p.hmw_statement}
                </p>
                {(p.target_user || p.success_metric) && (
                  <p className="text-[11px] text-nu-graphite mt-1">
                    {p.target_user && `대상: ${p.target_user}`}
                    {p.target_user && p.success_metric && " · "}
                    {p.success_metric && `지표: ${p.success_metric}`}
                  </p>
                )}
              </div>
              {!p.is_selected && (
                <button onClick={() => select(p.id)} className="border-[2px] border-nu-ink bg-nu-paper text-nu-ink px-2 py-1 font-mono-nu text-[9px] uppercase tracking-wider hover:bg-nu-pink hover:text-nu-paper hover:border-nu-pink flex-shrink-0">
                  선정
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ideate ───────────────────────────────────────────────────────

function IdeaSection({ items, projectId }: Props & { items: VentureIdea[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const router = useRouter();

  const submit = async () => {
    if (title.trim().length < 3) return toast.error("제목 3자 이상");
    const res = await fetch(`/api/venture/${projectId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "idea", title: title.trim(), description: desc.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) return toast.error(data.error || "실패");
    setTitle(""); setDesc(""); setOpen(false);
    router.refresh();
  };

  const vote = async (ideaId: string, weight: number) => {
    await fetch(`/api/venture/${projectId}/actions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "vote_idea", idea_id: ideaId, weight }),
    });
    router.refresh();
  };

  const setMain = async (ideaId: string) => {
    if (!confirm("이 아이디어를 Main Solution 으로 선정합니다. 계속?")) return;
    await fetch(`/api/venture/${projectId}/actions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_main_idea", idea_id: ideaId }),
    });
    toast.success("Main Solution 선정됨");
    router.refresh();
  };

  return (
    <div className="border-[2.5px] border-nu-ink bg-nu-paper">
      <div className="p-4 border-b-[2px] border-nu-ink flex justify-between items-center">
        <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">{items.length}개 아이디어</span>
        <button onClick={() => setOpen(!open)} className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-ink">
          {open ? "닫기" : "+ 아이디어"}
        </button>
      </div>
      {open && (
        <div className="p-4 border-b-[2px] border-nu-ink bg-nu-ink/5 flex flex-col gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="아이디어 제목" className="border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="설명" rows={2} className="border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]" />
          <button onClick={submit} className="border-[2.5px] border-nu-ink bg-nu-ink text-nu-paper py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-pink">저장</button>
        </div>
      )}
      <div className="divide-y divide-nu-ink/10">
        {items.length === 0 ? (
          <p className="p-6 text-center text-[12px] text-nu-graphite">아이디어 없음</p>
        ) : items.map((i) => (
          <div key={i.id} className={`p-4 ${i.is_main ? "bg-nu-pink/10" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {i.is_main && <span className="font-mono-nu text-[9px] bg-nu-pink text-nu-paper px-1.5 py-0.5 tracking-wider">MAIN</span>}
                  <h4 className={`font-bold text-[14px] text-nu-ink`}>{i.title}</h4>
                </div>
                {i.description && <p className="text-[12px] text-nu-graphite mt-1 leading-relaxed">{i.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-[10px] font-mono-nu text-nu-graphite">
                  <span>투표 {i.vote_count ?? 0}명 · 점수 {i.vote_total ?? 0}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <div className="flex gap-1">
                  {[1, 2, 3].map((w) => (
                    <button key={w} onClick={() => vote(i.id, w)} className="border-[1.5px] border-nu-ink w-7 h-7 font-mono-nu text-[10px] hover:bg-nu-pink hover:text-nu-paper hover:border-nu-pink" title={`가중치 ${w}`}>
                      {w}
                    </button>
                  ))}
                </div>
                {!i.is_main && (
                  <button onClick={() => setMain(i.id)} className="border-[2px] border-nu-ink bg-nu-paper text-nu-ink px-2 py-0.5 font-mono-nu text-[9px] uppercase tracking-wider hover:bg-nu-pink hover:text-nu-paper hover:border-nu-pink">
                    Main 선정
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Prototype ────────────────────────────────────────────────────

function PrototypeSection({ items, projectId }: Props & { items: { tasks: VenturePrototypeTask[]; feedback: VentureFeedback[] } }) {
  const [taskTitle, setTaskTitle] = useState("");
  const [fbNote, setFbNote] = useState("");
  const [fbScore, setFbScore] = useState<string>("");
  const [fbName, setFbName] = useState("");
  const router = useRouter();

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    await fetch(`/api/venture/${projectId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "task", title: taskTitle.trim() }),
    });
    setTaskTitle("");
    router.refresh();
  };

  const toggleTask = async (id: string, current: string) => {
    const next = current === "todo" ? "doing" : current === "doing" ? "done" : "todo";
    await fetch(`/api/venture/${projectId}/actions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_task", task_id: id, status: next }),
    });
    router.refresh();
  };

  const addFeedback = async () => {
    if (fbNote.trim().length < 3) return toast.error("피드백 3자 이상");
    const score = fbScore ? Number(fbScore) : undefined;
    await fetch(`/api/venture/${projectId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "feedback", note: fbNote.trim(),
        tester_name: fbName.trim() || undefined,
        score: score && !isNaN(score) ? score : undefined,
      }),
    });
    setFbNote(""); setFbScore(""); setFbName("");
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 체크리스트 */}
      <div className="border-[2.5px] border-nu-ink bg-nu-paper">
        <div className="p-3 border-b-[2px] border-nu-ink flex items-center gap-2">
          <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink flex-1">체크리스트</span>
          <span className="font-mono-nu text-[10px] text-nu-graphite">
            {items.tasks.filter((t) => t.status === "done").length} / {items.tasks.length}
          </span>
        </div>
        <div className="p-3 border-b-[2px] border-nu-ink flex gap-2">
          <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="+ MVP 태스크" onKeyDown={(e) => e.key === "Enter" && addTask()} className="flex-1 border-[2px] border-nu-ink bg-nu-paper px-2 py-1.5 text-[13px]" />
          <button onClick={addTask} className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-3 font-mono-nu text-[10px] uppercase">추가</button>
        </div>
        <ul className="divide-y divide-nu-ink/10">
          {items.tasks.length === 0 ? (
            <li className="p-6 text-center text-[12px] text-nu-graphite">태스크 없음</li>
          ) : items.tasks.map((t) => (
            <li key={t.id} className="p-3 flex items-center gap-2">
              <button onClick={() => toggleTask(t.id, t.status)} className={`w-6 h-6 border-[2px] border-nu-ink flex items-center justify-center ${
                t.status === "done" ? "bg-nu-pink text-nu-paper" : t.status === "doing" ? "bg-yellow-100" : "bg-nu-paper"
              }`}>
                {t.status === "done" ? "✓" : t.status === "doing" ? "→" : ""}
              </button>
              <span className={`flex-1 text-[13px] ${t.status === "done" ? "line-through text-nu-graphite" : "text-nu-ink"}`}>{t.title}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 피드백 */}
      <div className="border-[2.5px] border-nu-ink bg-nu-paper">
        <div className="p-3 border-b-[2px] border-nu-ink flex items-center">
          <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink flex-1">유저 피드백</span>
          <span className="font-mono-nu text-[10px] text-nu-graphite">{items.feedback.length}건</span>
        </div>
        <div className="p-3 border-b-[2px] border-nu-ink space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={fbName} onChange={(e) => setFbName(e.target.value)} placeholder="테스터 이름 (선택)" className="border-[2px] border-nu-ink bg-nu-paper px-2 py-1.5 text-[13px]" />
            <input value={fbScore} onChange={(e) => setFbScore(e.target.value)} type="number" min={1} max={10} placeholder="점수 1-10" className="border-[2px] border-nu-ink bg-nu-paper px-2 py-1.5 text-[13px]" />
          </div>
          <textarea value={fbNote} onChange={(e) => setFbNote(e.target.value)} placeholder="피드백 내용" rows={2} className="w-full border-[2px] border-nu-ink bg-nu-paper px-2 py-1.5 text-[13px]" />
          <button onClick={addFeedback} className="w-full border-[2.5px] border-nu-ink bg-nu-ink text-nu-paper py-1.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-pink">피드백 기록</button>
        </div>
        <ul className="divide-y divide-nu-ink/10 max-h-[300px] overflow-y-auto">
          {items.feedback.length === 0 ? (
            <li className="p-6 text-center text-[12px] text-nu-graphite">피드백 없음</li>
          ) : items.feedback.map((f) => (
            <li key={f.id} className="p-3">
              <div className="flex items-center gap-2 mb-1">
                {f.score != null && <span className="font-mono-nu text-[10px] border-[1.5px] border-nu-ink px-1.5 py-0.5">{f.score}/10</span>}
                {f.tester_name && <span className="text-[11px] text-nu-graphite">{f.tester_name}</span>}
              </div>
              <p className="text-[13px] text-nu-ink">{f.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
