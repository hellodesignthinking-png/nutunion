"use client";

import { useState } from "react";
import { Sparkles, Send, Loader2, Calendar, CheckSquare, Layers, Briefcase, X } from "lucide-react";
import { toast } from "sonner";

interface AiSuggestion {
  type: "task" | "event" | "info" | "link";
  title: string;
  detail?: string;
  action?: string;
  href?: string;
}

export function AiAssistantWidget() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setResponse(null);
    setSuggestions([]);

    const query = input.trim().toLowerCase();

    // Client-side AI parsing for common patterns
    try {
      // Task creation
      if (query.includes("할일") || query.includes("해야") || query.includes("todo")) {
        const title = input.replace(/할일\s*(추가|등록|만들|생성)?\s*:?\s*/i, "").replace(/해야\s*(할|하는)\s*(것|일)\s*:?\s*/i, "").trim();
        if (title) {
          const res = await fetch("/api/google/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, listId: "@default" }),
          });
          if (res.ok) {
            setResponse(`"${title}" 할일이 Google Tasks에 추가되었습니다.`);
            setSuggestions([
              { type: "task", title, detail: "Google Tasks에 추가됨" },
            ]);
          } else {
            setResponse("Google Tasks에 추가하지 못했습니다. Google 계정 연결을 확인해주세요.");
          }
        } else {
          setResponse("할일 제목을 입력해주세요. 예: '할일 추가: 보고서 작성'");
        }
      }
      // Event / schedule
      else if (query.includes("일정") || query.includes("미팅") || query.includes("회의") || query.includes("스케줄")) {
        setResponse("일정을 확인하려면 Google Calendar를 확인해보세요.");
        setSuggestions([
          { type: "link", title: "Google Calendar 열기", href: "https://calendar.google.com", detail: "브라우저에서 확인" },
          { type: "link", title: "스태프 캘린더", href: "/staff/calendar", detail: "스태프 페이지에서 확인" },
        ]);
      }
      // Nut/Bolt info
      else if (query.includes("너트") || query.includes("소모임")) {
        setResponse("너트(소모임) 관련 정보입니다.");
        setSuggestions([
          { type: "link", title: "내 너트 보기", href: "/groups", detail: "참여 중인 너트 목록" },
          { type: "link", title: "너트 만들기", href: "/groups/create", detail: "새 소모임 개설" },
        ]);
      }
      else if (query.includes("볼트") || query.includes("프로젝트")) {
        setResponse("볼트(프로젝트) 관련 정보입니다.");
        setSuggestions([
          { type: "link", title: "내 볼트 보기", href: "/projects", detail: "참여 중인 볼트 목록" },
          { type: "link", title: "볼트 만들기", href: "/projects/create", detail: "새 프로젝트 개설" },
        ]);
      }
      // General help
      else {
        setResponse(`"${input}" — 아래 기능을 사용해보세요:`);
        setSuggestions([
          { type: "info", title: "할일 추가", detail: "'할일 추가: [제목]' 으로 Google Tasks에 추가" },
          { type: "info", title: "일정 확인", detail: "'일정' 또는 '미팅' 으로 캘린더 확인" },
          { type: "info", title: "너트/볼트 관리", detail: "'너트' 또는 '볼트' 로 참여 현황 확인" },
        ]);
      }
    } catch {
      setResponse("요청 처리 중 오류가 발생했습니다.");
    }

    setInput("");
    setLoading(false);
  }

  const iconMap = {
    task: <CheckSquare size={12} className="text-indigo-500" />,
    event: <Calendar size={12} className="text-nu-pink" />,
    info: <Sparkles size={12} className="text-nu-amber" />,
    link: <Briefcase size={12} className="text-blue-500" />,
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50/50 to-nu-pink/5 border border-indigo-200/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-head text-sm font-extrabold text-nu-ink flex items-center gap-2">
          <Sparkles size={14} className="text-indigo-500" /> AI 어시스턴트
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="할일 추가, 일정 확인, 너트/볼트 관리..."
          className="flex-1 px-3 py-2 text-sm border border-indigo-200 bg-white outline-none focus:border-indigo-400 transition-colors"
        />
        <button type="submit" disabled={loading || !input.trim()}
          className="px-3 py-2 bg-indigo-600 text-white border-none cursor-pointer hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </form>

      {response && (
        <div className="space-y-2">
          <p className="text-xs text-nu-graphite">{response}</p>
          {suggestions.map((s, i) => (
            s.href ? (
              <a key={i} href={s.href} target={s.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 bg-white border border-nu-ink/[0.06] hover:border-indigo-200 transition-colors no-underline">
                {iconMap[s.type]}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-nu-ink">{s.title}</p>
                  {s.detail && <p className="text-[11px] text-nu-muted">{s.detail}</p>}
                </div>
              </a>
            ) : (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-white border border-nu-ink/[0.06]">
                {iconMap[s.type]}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-nu-ink">{s.title}</p>
                  {s.detail && <p className="text-[11px] text-nu-muted">{s.detail}</p>}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {!response && (
        <div className="flex flex-wrap gap-1.5">
          {["할일 추가: ", "오늘 일정", "내 너트", "내 볼트"].map(q => (
            <button key={q} onClick={() => { setInput(q); }}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-white border border-indigo-100 text-indigo-500 cursor-pointer hover:bg-indigo-50 transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
