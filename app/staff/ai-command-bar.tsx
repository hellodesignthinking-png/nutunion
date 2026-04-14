"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sparkles, Send, X, Check, Calendar, CheckSquare, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ParsedAction {
  type: "task" | "event" | "note";
  title: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  projectId?: string;
  projectName?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
}

interface StaffProject {
  id: string;
  title: string;
}

export function AICommandBar() {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedActions, setParsedActions] = useState<ParsedAction[]>([]);
  const [projects, setProjects] = useState<StaffProject[]>([]);
  const [communityProjects, setCommunityProjects] = useState<StaffProject[]>([]);
  const [userId, setUserId] = useState("");
  const [executing, setExecuting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const [{ data: sp }, { data: cp }] = await Promise.all([
        supabase.from("staff_projects").select("id, title").eq("status", "active").order("title"),
        supabase.from("projects").select("id, title").eq("status", "active").order("title"),
      ]);
      setProjects(sp || []);
      setCommunityProjects(cp || []);
    }
    loadData();
  }, []);

  function parseInput(text: string): ParsedAction[] {
    const actions: ParsedAction[] = [];
    const lines = text.split("\n").filter(l => l.trim());

    for (const line of lines) {
      const trimmed = line.trim();

      // 일정 감지: "내일 3시 미팅", "4/20 14:00 회의"
      const dateTimeMatch = trimmed.match(
        /(?:(\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}|내일|모레|오늘)\s*)?(\d{1,2})[:\s]?(\d{2})?\s*(시|pm|am)?\s*(.*)/i
      );
      const eventKeywords = ["미팅", "회의", "발표", "세미나", "워크숍", "점심", "저녁", "만남", "통화", "콜"];
      const isEvent = eventKeywords.some(k => trimmed.includes(k));

      if (isEvent) {
        const today = new Date();
        let dateStr = "";
        if (trimmed.includes("내일")) {
          const d = new Date(today); d.setDate(d.getDate() + 1);
          dateStr = d.toISOString().split("T")[0];
        } else if (trimmed.includes("모레")) {
          const d = new Date(today); d.setDate(d.getDate() + 2);
          dateStr = d.toISOString().split("T")[0];
        } else {
          const dateMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})/);
          if (dateMatch) {
            dateStr = `${today.getFullYear()}-${dateMatch[1].padStart(2, "0")}-${dateMatch[2].padStart(2, "0")}`;
          } else {
            dateStr = today.toISOString().split("T")[0];
          }
        }

        const timeMatch = trimmed.match(/(\d{1,2}):?(\d{2})?\s*(시|pm|am)?/i);
        let startHour = timeMatch ? parseInt(timeMatch[1]) : 10;
        if (timeMatch?.[3]?.toLowerCase() === "pm" && startHour < 12) startHour += 12;
        const startMin = timeMatch?.[2] || "00";

        actions.push({
          type: "event",
          title: trimmed.replace(/\d{1,2}\/\d{1,2}|내일|모레|오늘|\d{1,2}:\d{2}|\d{1,2}시/g, "").trim() || trimmed,
          startTime: `${startHour.toString().padStart(2, "0")}:${startMin}`,
          endTime: `${(startHour + 1).toString().padStart(2, "0")}:${startMin}`,
          dueDate: dateStr,
        });
      } else {
        // 할일로 분류
        const priorityMap: Record<string, string> = {
          "긴급": "urgent", "급함": "urgent", "중요": "high",
          "높음": "high", "보통": "medium", "낮음": "low",
        };
        let priority = "medium";
        for (const [keyword, value] of Object.entries(priorityMap)) {
          if (trimmed.includes(keyword)) { priority = value; break; }
        }

        // 날짜 추출
        let dueDate: string | undefined;
        const dueDateMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})/);
        if (dueDateMatch) {
          const today = new Date();
          dueDate = `${today.getFullYear()}-${dueDateMatch[1].padStart(2, "0")}-${dueDateMatch[2].padStart(2, "0")}`;
        } else if (trimmed.includes("내일")) {
          const d = new Date(); d.setDate(d.getDate() + 1);
          dueDate = d.toISOString().split("T")[0];
        } else if (trimmed.includes("이번주")) {
          const d = new Date(); d.setDate(d.getDate() + (5 - d.getDay()));
          dueDate = d.toISOString().split("T")[0];
        }

        // 프로젝트 매칭
        let matchedProject: StaffProject | undefined;
        const allProjects = [...projects, ...communityProjects];
        for (const p of allProjects) {
          if (trimmed.toLowerCase().includes(p.title.toLowerCase())) {
            matchedProject = p;
            break;
          }
        }

        actions.push({
          type: "task",
          title: trimmed.replace(/긴급|급함|중요|높음|보통|낮음|내일|이번주|\d{1,2}\/\d{1,2}/g, "").trim() || trimmed,
          priority,
          dueDate,
          projectId: matchedProject?.id,
          projectName: matchedProject?.title,
        });
      }
    }
    return actions;
  }

  function handleParse() {
    if (!input.trim()) return;
    setParsing(true);
    // 약간의 딜레이로 분석 느낌 연출
    setTimeout(() => {
      const actions = parseInput(input);
      setParsedActions(actions);
      setParsing(false);
    }, 300);
  }

  async function handleExecute() {
    if (parsedActions.length === 0) return;
    setExecuting(true);
    const supabase = createClient();
    let successCount = 0;

    for (const action of parsedActions) {
      if (action.type === "task") {
        const { error } = await supabase.from("staff_tasks").insert({
          project_id: action.projectId || projects[0]?.id,
          title: action.title,
          priority: action.priority || "medium",
          due_date: action.dueDate || null,
          created_by: userId,
          assigned_to: userId,
          source_type: "ai",
        });
        if (!error) successCount++;
      } else if (action.type === "event") {
        try {
          const dateStr = action.dueDate || new Date().toISOString().split("T")[0];
          const res = await fetch("/api/google/calendar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: action.title,
              startTime: `${dateStr}T${action.startTime}:00+09:00`,
              endTime: `${dateStr}T${action.endTime}:00+09:00`,
              location: action.location || "",
              description: "",
            }),
          });
          if (res.ok) successCount++;
        } catch {
          // 캘린더 미연결 시 할일로 대체
          await supabase.from("staff_tasks").insert({
            project_id: projects[0]?.id,
            title: `[일정] ${action.title}`,
            priority: "high",
            due_date: action.dueDate || null,
            created_by: userId,
            assigned_to: userId,
            source_type: "ai",
          });
          successCount++;
        }
      }
    }

    toast.success(`${successCount}개 항목이 등록되었습니다`);
    setInput("");
    setParsedActions([]);
    setIsOpen(false);
    setExecuting(false);
    // 페이지 새로고침으로 데이터 반영
    window.location.reload();
  }

  const actionIcon = (type: string) => {
    switch (type) {
      case "event": return <Calendar size={14} className="text-indigo-600" />;
      case "task": return <CheckSquare size={14} className="text-green-600" />;
      default: return <FolderOpen size={14} className="text-nu-muted" />;
    }
  };

  const actionLabel = (type: string) => {
    switch (type) {
      case "event": return "일정";
      case "task": return "할일";
      default: return "메모";
    }
  };

  return (
    <div className="mb-8">
      {/* Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
          className="w-full flex items-center gap-3 px-5 py-4 bg-white border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-colors cursor-pointer text-left group"
        >
          <Sparkles size={18} className="text-indigo-400 group-hover:text-indigo-600 transition-colors" />
          <span className="font-mono-nu text-[11px] text-nu-muted group-hover:text-nu-graphite uppercase tracking-widest">
            할 일, 일정, 메모를 자유롭게 입력하세요...
          </span>
          <span className="ml-auto font-mono-nu text-[9px] text-nu-muted/50 uppercase tracking-widest hidden sm:block">
            AI 자동 분류
          </span>
        </button>
      )}

      {/* Expanded Input */}
      {isOpen && (
        <div className="bg-white border-2 border-indigo-300 shadow-lg">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-indigo-100 bg-indigo-50/30">
            <Sparkles size={14} className="text-indigo-600" />
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-indigo-600 font-bold">AI 커맨드</span>
            <span className="font-mono-nu text-[9px] text-nu-muted ml-1">여러 줄로 입력 가능 · 자동 분류됩니다</span>
            <button
              onClick={() => { setIsOpen(false); setParsedActions([]); setInput(""); }}
              className="ml-auto p-1 text-nu-muted hover:text-nu-ink bg-transparent border-none cursor-pointer"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={"예시:\n내일 3시 디자인팀 미팅\n긴급 랜딩페이지 수정\n이번주 보고서 초안 작성"}
            rows={4}
            className="w-full px-4 py-3 text-sm border-none outline-none resize-none bg-transparent"
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleParse(); }}
          />
          <div className="flex items-center justify-between px-4 py-2 border-t border-nu-ink/5 bg-nu-ink/[0.02]">
            <span className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest">
              Ctrl+Enter로 분석
            </span>
            <button
              onClick={handleParse}
              disabled={!input.trim() || parsing}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white font-mono-nu text-[10px] uppercase tracking-widest border-none cursor-pointer hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {parsing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {parsing ? "분석 중..." : "분석"}
            </button>
          </div>

          {/* Parsed Results */}
          {parsedActions.length > 0 && (
            <div className="border-t-2 border-indigo-200">
              <div className="px-4 py-2 bg-indigo-50/50">
                <span className="font-mono-nu text-[10px] uppercase tracking-widest text-indigo-600 font-bold">
                  분석 결과 — {parsedActions.length}개 항목
                </span>
              </div>
              <div className="divide-y divide-nu-ink/5">
                {parsedActions.map((action, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    {actionIcon(action.type)}
                    <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 ${
                      action.type === "event" ? "bg-indigo-100 text-indigo-700" : "bg-green-100 text-green-700"
                    }`}>
                      {actionLabel(action.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-head text-sm font-bold text-nu-ink truncate">{action.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {action.dueDate && (
                          <span className="font-mono-nu text-[8px] text-nu-muted">{action.dueDate}</span>
                        )}
                        {action.startTime && (
                          <span className="font-mono-nu text-[8px] text-nu-muted">{action.startTime}~{action.endTime}</span>
                        )}
                        {action.priority && action.type === "task" && (
                          <span className={`font-mono-nu text-[8px] px-1.5 py-px ${
                            action.priority === "urgent" ? "bg-red-100 text-red-700" :
                            action.priority === "high" ? "bg-orange-100 text-orange-700" : "text-nu-muted"
                          }`}>
                            {action.priority}
                          </span>
                        )}
                        {action.projectName && (
                          <span className="font-mono-nu text-[8px] text-indigo-600">{action.projectName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 px-4 py-3 bg-nu-ink/[0.02] border-t border-nu-ink/5">
                <button
                  onClick={() => setParsedActions([])}
                  className="px-4 py-2 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted border border-nu-ink/15 bg-transparent cursor-pointer hover:border-nu-ink/30 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleExecute}
                  disabled={executing}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white font-mono-nu text-[10px] uppercase tracking-widest border-none cursor-pointer hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {executing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  {executing ? "등록 중..." : "등록하기"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
