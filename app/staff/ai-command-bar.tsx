"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles, Send, X, Check, Calendar, CheckSquare, FolderOpen,
  Loader2, Trash2, Edit3, Clock, AlertTriangle, ChevronDown,
  Plus, ArrowRight, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

/* ── Types ──────────────────────────────────────────────────── */
interface ParsedAction {
  id: string; // unique key for editing
  type: "task" | "event";
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  priority: "urgent" | "high" | "medium" | "low";
  projectId: string;
  projectName: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  location: string;
  enabled: boolean; // user can toggle off individual items
}

interface StaffProject {
  id: string;
  title: string;
}

let _idCounter = 0;
function uid() { return `pa-${++_idCounter}-${Date.now()}`; }

/* ── Helpers ────────────────────────────────────────────────── */
const PRIORITY_OPTIONS = [
  { value: "urgent", label: "긴급", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "high", label: "높음", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "medium", label: "보통", color: "bg-nu-ink/5 text-nu-graphite border-nu-ink/10" },
  { value: "low", label: "낮음", color: "bg-blue-50 text-blue-600 border-blue-200" },
] as const;

const EVENT_KEYWORDS = ["미팅", "회의", "발표", "세미나", "워크숍", "점심", "저녁", "만남", "통화", "콜", "리뷰", "스탠드업", "면접", "상담"];

function formatDateLabel(d: string) {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getTime() === today.getTime()) return "오늘";
  if (date.getTime() === tomorrow.getTime()) return "내일";
  return date.toLocaleDateString("ko", { month: "short", day: "numeric", weekday: "short" });
}

/* ── Component ──────────────────────────────────────────────── */
export function AICommandBar() {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedActions, setParsedActions] = useState<ParsedAction[]>([]);
  const [projects, setProjects] = useState<StaffProject[]>([]);
  const [communityProjects, setCommunityProjects] = useState<StaffProject[]>([]);
  const [userId, setUserId] = useState("");
  const [executing, setExecuting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [{ data: sp }, { data: cp }, { data: profile }] = await Promise.all([
        supabase.from("staff_projects").select("id, title").eq("status", "active").order("title"),
        supabase.from("projects").select("id, title").eq("status", "active").order("title"),
        supabase.from("profiles").select("google_refresh_token").eq("id", user.id).single(),
      ]);
      setProjects(sp || []);
      setCommunityProjects(cp || []);
      setGoogleConnected(!!profile?.google_refresh_token);
    }
    loadData();
  }, []);

  /* ── Parse Input ──────────────────────────────────────────── */
  const parseInput = useCallback((text: string): ParsedAction[] => {
    const actions: ParsedAction[] = [];
    const lines = text.split("\n").filter(l => l.trim());
    const allProjects = [...projects, ...communityProjects];
    const today = new Date();

    for (const line of lines) {
      const trimmed = line.trim();
      const isEvent = EVENT_KEYWORDS.some(k => trimmed.includes(k));

      // ── Date extraction ──
      let dateStr = "";
      if (trimmed.includes("내일")) {
        const d = new Date(today); d.setDate(d.getDate() + 1);
        dateStr = d.toISOString().split("T")[0];
      } else if (trimmed.includes("모레")) {
        const d = new Date(today); d.setDate(d.getDate() + 2);
        dateStr = d.toISOString().split("T")[0];
      } else if (trimmed.includes("이번주")) {
        const d = new Date(today); d.setDate(d.getDate() + (5 - d.getDay()));
        dateStr = d.toISOString().split("T")[0];
      } else if (trimmed.includes("다음주")) {
        const d = new Date(today); d.setDate(d.getDate() + (8 - d.getDay()));
        dateStr = d.toISOString().split("T")[0];
      } else {
        const dateMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})/);
        if (dateMatch) {
          dateStr = `${today.getFullYear()}-${dateMatch[1].padStart(2, "0")}-${dateMatch[2].padStart(2, "0")}`;
        } else if (isEvent) {
          dateStr = today.toISOString().split("T")[0];
        }
      }

      // ── Time extraction ──
      const timeMatch = trimmed.match(/(\d{1,2}):?(\d{2})?\s*(시|pm|am)?/i);
      let startHour = timeMatch ? parseInt(timeMatch[1]) : 10;
      if (timeMatch?.[3]?.toLowerCase() === "pm" && startHour < 12) startHour += 12;
      const startMin = timeMatch?.[2] || "00";

      // ── Priority extraction ──
      const priorityMap: Record<string, ParsedAction["priority"]> = {
        "긴급": "urgent", "급함": "urgent", "중요": "high",
        "높음": "high", "보통": "medium", "낮음": "low",
      };
      let priority: ParsedAction["priority"] = "medium";
      for (const [keyword, value] of Object.entries(priorityMap)) {
        if (trimmed.includes(keyword)) { priority = value; break; }
      }

      // ── Project matching ──
      let matchedProject: StaffProject | undefined;
      for (const p of allProjects) {
        if (trimmed.toLowerCase().includes(p.title.toLowerCase())) {
          matchedProject = p; break;
        }
      }

      // ── Clean title ──
      const cleanTitle = trimmed
        .replace(/\d{1,2}\/\d{1,2}|내일|모레|오늘|이번주|다음주|\d{1,2}:\d{2}|\d{1,2}시/g, "")
        .replace(/긴급|급함|중요|높음|보통|낮음/g, "")
        .replace(/\s+/g, " ")
        .trim() || trimmed;

      if (isEvent) {
        actions.push({
          id: uid(),
          type: "event",
          title: cleanTitle,
          description: "",
          dueDate: dateStr,
          priority: "medium",
          projectId: "",
          projectName: "",
          startTime: `${startHour.toString().padStart(2, "0")}:${startMin}`,
          endTime: `${(startHour + 1).toString().padStart(2, "0")}:${startMin}`,
          location: "",
          enabled: true,
        });
      } else {
        actions.push({
          id: uid(),
          type: "task",
          title: cleanTitle,
          description: "",
          dueDate: dateStr,
          priority,
          projectId: matchedProject?.id || "",
          projectName: matchedProject?.title || "",
          startTime: "",
          endTime: "",
          location: "",
          enabled: true,
        });
      }
    }
    return actions;
  }, [projects, communityProjects]);

  function handleParse() {
    if (!input.trim()) return;
    setParsing(true);
    setTimeout(() => {
      const actions = parseInput(input);
      setParsedActions(actions);
      setParsing(false);
      setEditingId(null);
    }, 300);
  }

  /* ── Update a single action ──────────────────────────────── */
  function updateAction(id: string, updates: Partial<ParsedAction>) {
    setParsedActions(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }

  function removeAction(id: string) {
    setParsedActions(prev => prev.filter(a => a.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function toggleAction(id: string) {
    setParsedActions(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }

  function addEmptyAction(type: "task" | "event") {
    const today = new Date().toISOString().split("T")[0];
    const newAction: ParsedAction = {
      id: uid(),
      type,
      title: "",
      description: "",
      dueDate: type === "event" ? today : "",
      priority: "medium",
      projectId: "",
      projectName: "",
      startTime: type === "event" ? "10:00" : "",
      endTime: type === "event" ? "11:00" : "",
      location: "",
      enabled: true,
    };
    setParsedActions(prev => [...prev, newAction]);
    setEditingId(newAction.id);
  }

  /* ── Execute ──────────────────────────────────────────────── */
  async function handleExecute() {
    const enabled = parsedActions.filter(a => a.enabled && a.title.trim());
    if (enabled.length === 0) {
      toast.error("등록할 항목이 없습니다");
      return;
    }
    setExecuting(true);
    const supabase = createClient();
    let taskCount = 0;
    let eventCount = 0;
    let failedEvents: string[] = [];

    for (const action of enabled) {
      if (action.type === "task") {
        const { error } = await supabase.from("staff_tasks").insert({
          project_id: action.projectId || projects[0]?.id || null,
          title: action.title,
          description: action.description || null,
          priority: action.priority || "medium",
          due_date: action.dueDate || null,
          created_by: userId,
          assigned_to: userId,
          source_type: "ai",
        });
        if (!error) taskCount++;
      } else if (action.type === "event") {
        const dateStr = action.dueDate || new Date().toISOString().split("T")[0];
        try {
          const res = await fetch("/api/google/calendar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: action.title,
              startTime: `${dateStr}T${action.startTime || "10:00"}:00+09:00`,
              endTime: `${dateStr}T${action.endTime || "11:00"}:00+09:00`,
              location: action.location || "",
              description: action.description || "",
            }),
          });
          if (res.ok) {
            eventCount++;
          } else {
            failedEvents.push(action.title);
          }
        } catch {
          failedEvents.push(action.title);
        }

        // Fallback: if calendar failed, create as task
        if (failedEvents.includes(action.title)) {
          await supabase.from("staff_tasks").insert({
            project_id: projects[0]?.id || null,
            title: `[일정] ${action.title}`,
            description: `${action.startTime || ""}~${action.endTime || ""} ${action.location || ""}`.trim(),
            priority: "high",
            due_date: action.dueDate || null,
            created_by: userId,
            assigned_to: userId,
            source_type: "ai",
          });
          taskCount++;
          failedEvents = failedEvents.filter(t => t !== action.title);
        }
      }
    }

    const parts = [];
    if (taskCount > 0) parts.push(`할일 ${taskCount}개`);
    if (eventCount > 0) parts.push(`일정 ${eventCount}개`);
    toast.success(`${parts.join(", ")} 등록 완료!`);

    setInput("");
    setParsedActions([]);
    setIsOpen(false);
    setExecuting(false);
    setEditingId(null);
    window.location.reload();
  }

  const enabledCount = parsedActions.filter(a => a.enabled && a.title.trim()).length;
  const allProjects = [...projects, ...communityProjects];

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="mb-8">
      {/* Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
          className="w-full flex items-center gap-3 px-5 py-4 bg-white border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-colors cursor-pointer text-left group"
        >
          <Sparkles size={18} className="text-indigo-400 group-hover:text-indigo-600 transition-colors" />
          <span className="font-mono-nu text-[13px] text-nu-muted group-hover:text-nu-graphite uppercase tracking-widest">
            할일, 일정을 자유롭게 입력하세요...
          </span>
          <span className="ml-auto font-mono-nu text-[11px] text-nu-muted/50 uppercase tracking-widest hidden sm:block">
            AI 자동 분류
          </span>
        </button>
      )}

      {/* Expanded Panel */}
      {isOpen && (
        <div className="bg-white border-2 border-indigo-300 shadow-lg">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-indigo-100 bg-indigo-50/30">
            <Sparkles size={14} className="text-indigo-600" />
            <span className="font-mono-nu text-[12px] uppercase tracking-widest text-indigo-600 font-bold">AI 커맨드</span>
            <span className="font-mono-nu text-[11px] text-nu-muted ml-1">여러 줄 입력 → 자동 분류 → 수정 → 등록</span>
            {googleConnected === false && (
              <span className="font-mono-nu text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 border border-amber-200 ml-auto mr-2">
                Google 미연결 (일정→할일 대체)
              </span>
            )}
            {googleConnected === true && (
              <span className="font-mono-nu text-[10px] text-green-600 bg-green-50 px-2 py-0.5 border border-green-200 ml-auto mr-2">
                Google 연결됨
              </span>
            )}
            <button
              onClick={() => { setIsOpen(false); setParsedActions([]); setInput(""); setEditingId(null); }}
              className="p-1 text-nu-muted hover:text-nu-ink bg-transparent border-none cursor-pointer"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          </div>

          {/* Input Area */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={"예시:\n내일 3시 디자인팀 미팅\n긴급 랜딩페이지 수정\n이번주 보고서 초안 작성\n4/20 14:00 클라이언트 콜"}
            rows={4}
            className="w-full px-4 py-3 text-sm border-none outline-none resize-none bg-transparent"
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleParse(); }}
          />
          <div className="flex items-center justify-between px-4 py-2 border-t border-nu-ink/5 bg-nu-ink/[0.02]">
            <span className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">
              Ctrl+Enter로 분석
            </span>
            <button
              onClick={handleParse}
              disabled={!input.trim() || parsing}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white font-mono-nu text-[12px] uppercase tracking-widest border-none cursor-pointer hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {parsing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {parsing ? "분석 중..." : "분석"}
            </button>
          </div>

          {/* ── Parsed Results (Editable Preview) ──────────── */}
          {parsedActions.length > 0 && (
            <div className="border-t-2 border-indigo-200">
              {/* Summary Header */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50/50">
                <span className="font-mono-nu text-[12px] uppercase tracking-widest text-indigo-600 font-bold">
                  분석 결과
                </span>
                <div className="flex items-center gap-2">
                  {parsedActions.filter(a => a.type === "task").length > 0 && (
                    <span className="font-mono-nu text-[11px] bg-green-100 text-green-700 px-2 py-0.5 border border-green-200">
                      할일 {parsedActions.filter(a => a.type === "task").length}
                    </span>
                  )}
                  {parsedActions.filter(a => a.type === "event").length > 0 && (
                    <span className="font-mono-nu text-[11px] bg-indigo-100 text-indigo-700 px-2 py-0.5 border border-indigo-200">
                      일정 {parsedActions.filter(a => a.type === "event").length}
                    </span>
                  )}
                </div>
                <span className="font-mono-nu text-[10px] text-nu-muted ml-auto">
                  카드를 클릭하여 수정
                </span>
              </div>

              {/* Action Cards */}
              <div className="divide-y divide-nu-ink/5">
                {parsedActions.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    isEditing={editingId === action.id}
                    onStartEdit={() => setEditingId(action.id)}
                    onStopEdit={() => setEditingId(null)}
                    onUpdate={(updates) => updateAction(action.id, updates)}
                    onRemove={() => removeAction(action.id)}
                    onToggle={() => toggleAction(action.id)}
                    allProjects={allProjects}
                    googleConnected={googleConnected}
                  />
                ))}
              </div>

              {/* Add More + Execute Footer */}
              <div className="flex items-center justify-between px-4 py-3 bg-nu-ink/[0.02] border-t border-nu-ink/5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => addEmptyAction("task")}
                    className="flex items-center gap-1 px-3 py-1.5 font-mono-nu text-[11px] text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 cursor-pointer uppercase tracking-widest transition-colors"
                  >
                    <Plus size={10} /> 할일 추가
                  </button>
                  <button
                    onClick={() => addEmptyAction("event")}
                    className="flex items-center gap-1 px-3 py-1.5 font-mono-nu text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 cursor-pointer uppercase tracking-widest transition-colors"
                  >
                    <Plus size={10} /> 일정 추가
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setParsedActions([]); setEditingId(null); }}
                    className="px-4 py-2 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted border border-nu-ink/15 bg-transparent cursor-pointer hover:border-nu-ink/30 transition-colors"
                  >
                    초기화
                  </button>
                  <button
                    onClick={handleExecute}
                    disabled={executing || enabledCount === 0}
                    className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white font-mono-nu text-[12px] uppercase tracking-widest border-none cursor-pointer hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {executing ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                    {executing ? "등록 중..." : `${enabledCount}개 등록하기`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── ActionCard (Editable Preview Card) ─────────────────────── */
function ActionCard({
  action, isEditing, onStartEdit, onStopEdit, onUpdate, onRemove, onToggle,
  allProjects, googleConnected,
}: {
  action: ParsedAction;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onUpdate: (updates: Partial<ParsedAction>) => void;
  onRemove: () => void;
  onToggle: () => void;
  allProjects: StaffProject[];
  googleConnected: boolean | null;
}) {
  const isEvent = action.type === "event";
  const borderColor = !action.enabled ? "border-l-nu-muted" : isEvent ? "border-l-indigo-500" : "border-l-green-500";

  /* ── Compact View (not editing) ── */
  if (!isEditing) {
    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-nu-cream/30 transition-colors border-l-[3px] ${borderColor} ${!action.enabled ? "opacity-40" : ""}`}
        onClick={onStartEdit}
      >
        {/* Toggle */}
        <button
          onClick={e => { e.stopPropagation(); onToggle(); }}
          className={`w-5 h-5 border-2 flex items-center justify-center shrink-0 cursor-pointer bg-transparent transition-colors ${
            action.enabled
              ? isEvent ? "border-indigo-400 bg-indigo-50" : "border-green-400 bg-green-50"
              : "border-nu-ink/20"
          }`}
          aria-label={action.enabled ? "비활성화" : "활성화"}
        >
          {action.enabled && <Check size={10} className={isEvent ? "text-indigo-600" : "text-green-600"} />}
        </button>

        {/* Type Badge */}
        <span className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 shrink-0 border ${
          isEvent ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-green-50 text-green-700 border-green-200"
        }`}>
          {isEvent ? "일정" : "할일"}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-head text-sm font-bold text-nu-ink truncate">
            {action.title || <span className="text-nu-muted italic">제목 없음</span>}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {action.dueDate && (
              <span className="font-mono-nu text-[10px] text-nu-muted flex items-center gap-0.5">
                <Calendar size={8} /> {formatDateLabel(action.dueDate)}
              </span>
            )}
            {isEvent && action.startTime && (
              <span className="font-mono-nu text-[10px] text-indigo-600 flex items-center gap-0.5">
                <Clock size={8} /> {action.startTime}~{action.endTime}
              </span>
            )}
            {!isEvent && action.priority && action.priority !== "medium" && (
              <span className={`font-mono-nu text-[10px] px-1.5 py-px border ${
                PRIORITY_OPTIONS.find(p => p.value === action.priority)?.color || ""
              }`}>
                {PRIORITY_OPTIONS.find(p => p.value === action.priority)?.label}
              </span>
            )}
            {action.projectName && (
              <span className="font-mono-nu text-[10px] text-indigo-600 flex items-center gap-0.5">
                <FolderOpen size={8} /> {action.projectName}
              </span>
            )}
            {isEvent && !googleConnected && (
              <span className="font-mono-nu text-[9px] text-amber-600 flex items-center gap-0.5">
                <AlertTriangle size={7} /> 할일로 대체
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={e => { e.stopPropagation(); onStartEdit(); }}
          className="p-1.5 text-nu-muted hover:text-indigo-600 bg-transparent border-none cursor-pointer transition-colors"
          aria-label="수정"
        >
          <Edit3 size={13} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="p-1.5 text-nu-muted hover:text-red-500 bg-transparent border-none cursor-pointer transition-colors"
          aria-label="삭제"
        >
          <Trash2 size={13} />
        </button>
      </div>
    );
  }

  /* ── Expanded Edit View ── */
  return (
    <div className={`px-4 py-4 bg-nu-cream/20 border-l-[3px] ${borderColor}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Type Switcher */}
          <button
            onClick={() => onUpdate({ type: "task" })}
            className={`font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1 border cursor-pointer transition-colors ${
              !isEvent ? "bg-green-100 text-green-700 border-green-300" : "bg-transparent text-nu-muted border-nu-ink/10 hover:border-green-300"
            }`}
          >
            <CheckSquare size={10} className="inline mr-1" /> 할일
          </button>
          <button
            onClick={() => onUpdate({ type: "event", startTime: action.startTime || "10:00", endTime: action.endTime || "11:00", dueDate: action.dueDate || new Date().toISOString().split("T")[0] })}
            className={`font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1 border cursor-pointer transition-colors ${
              isEvent ? "bg-indigo-100 text-indigo-700 border-indigo-300" : "bg-transparent text-nu-muted border-nu-ink/10 hover:border-indigo-300"
            }`}
          >
            <Calendar size={10} className="inline mr-1" /> 일정
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRemove}
            className="p-1 text-nu-muted hover:text-red-500 bg-transparent border-none cursor-pointer transition-colors"
            aria-label="삭제"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onStopEdit}
            className="px-3 py-1 font-mono-nu text-[11px] text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 cursor-pointer uppercase tracking-widest transition-colors"
          >
            완료
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        value={action.title}
        onChange={e => onUpdate({ title: e.target.value })}
        placeholder="제목을 입력하세요"
        className="w-full px-3 py-2 border border-nu-ink/10 bg-white text-sm font-head font-bold text-nu-ink focus:outline-none focus:border-indigo-400 mb-2 transition-colors"
        autoFocus
      />

      {/* Description */}
      <input
        value={action.description}
        onChange={e => onUpdate({ description: e.target.value })}
        placeholder="설명 (선택사항)"
        className="w-full px-3 py-1.5 border border-nu-ink/10 bg-white text-xs text-nu-graphite focus:outline-none focus:border-indigo-300 mb-3 transition-colors"
      />

      {/* Fields Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Date */}
        <div>
          <label className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest block mb-1">날짜</label>
          <input
            type="date"
            value={action.dueDate}
            onChange={e => onUpdate({ dueDate: e.target.value })}
            className="w-full px-2 py-1.5 border border-nu-ink/10 bg-white font-mono-nu text-[13px] focus:outline-none focus:border-indigo-400 transition-colors"
          />
        </div>

        {/* Time (events only) */}
        {isEvent && (
          <>
            <div>
              <label className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest block mb-1">시작</label>
              <input
                type="time"
                value={action.startTime}
                onChange={e => onUpdate({ startTime: e.target.value })}
                className="w-full px-2 py-1.5 border border-nu-ink/10 bg-white font-mono-nu text-[13px] focus:outline-none focus:border-indigo-400 transition-colors"
              />
            </div>
            <div>
              <label className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest block mb-1">종료</label>
              <input
                type="time"
                value={action.endTime}
                onChange={e => onUpdate({ endTime: e.target.value })}
                className="w-full px-2 py-1.5 border border-nu-ink/10 bg-white font-mono-nu text-[13px] focus:outline-none focus:border-indigo-400 transition-colors"
              />
            </div>
          </>
        )}

        {/* Priority (tasks only) */}
        {!isEvent && (
          <div>
            <label className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest block mb-1">우선순위</label>
            <select
              value={action.priority}
              onChange={e => onUpdate({ priority: e.target.value as ParsedAction["priority"] })}
              className="w-full px-2 py-1.5 border border-nu-ink/10 bg-white font-mono-nu text-[13px] focus:outline-none focus:border-indigo-400 transition-colors appearance-none cursor-pointer"
            >
              {PRIORITY_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Project (tasks only) */}
        {!isEvent && (
          <div>
            <label className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest block mb-1">프로젝트</label>
            <select
              value={action.projectId}
              onChange={e => {
                const proj = allProjects.find(p => p.id === e.target.value);
                onUpdate({ projectId: e.target.value, projectName: proj?.title || "" });
              }}
              className="w-full px-2 py-1.5 border border-nu-ink/10 bg-white font-mono-nu text-[13px] focus:outline-none focus:border-indigo-400 transition-colors appearance-none cursor-pointer"
            >
              <option value="">선택 안 함</option>
              {allProjects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        )}

        {/* Location (events only) */}
        {isEvent && (
          <div className="col-span-2 sm:col-span-1">
            <label className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest block mb-1">장소</label>
            <input
              value={action.location}
              onChange={e => onUpdate({ location: e.target.value })}
              placeholder="장소 (선택)"
              className="w-full px-2 py-1.5 border border-nu-ink/10 bg-white font-mono-nu text-[13px] focus:outline-none focus:border-indigo-300 transition-colors"
            />
          </div>
        )}
      </div>
    </div>
  );
}
