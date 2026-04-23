"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Sun, Calendar, Users, Bot,
  CheckSquare, Clock, ChevronRight,
  Bell, MessageSquare, Layers, Briefcase,
  BookOpen, FolderOpen, Sparkles, Zap,
  ArrowRight, PenLine,
} from "lucide-react";
import Link from "next/link";
import { MorningBriefing } from "@/components/dashboard/morning-briefing";
import { MyTasksWidget } from "@/components/dashboard/my-tasks-widget";

const InlineCalendarPreview = dynamic(
  () => import("@/components/dashboard/inline-calendar-preview").then((m) => m.InlineCalendarPreview),
  { loading: () => <div className="h-48 bg-nu-cream/30 animate-pulse" /> }
);
const MyCalendarWidget = dynamic(
  () => import("@/components/dashboard/my-calendar-widget").then((m) => m.MyCalendarWidget),
  { loading: () => <div className="h-40 bg-nu-cream/30 animate-pulse" /> }
);
const AICommandBar = dynamic(
  () => import("@/components/dashboard/ai-command-bar").then((m) => m.AICommandBar),
  { loading: () => <div className="h-48 bg-nu-cream/30 animate-pulse" /> }
);
const PersonalHubWidget = dynamic(
  () => import("@/components/dashboard/personal-hub-widget").then((m) => m.PersonalHubWidget),
  { loading: () => <div className="h-32 bg-nu-cream/30 animate-pulse" /> }
);

const TABS = [
  { key: "today", label: "오늘", icon: Sun },
  { key: "ai", label: "AI 어시스턴트", icon: Bot },
  { key: "week", label: "이번 주", icon: Calendar },
  { key: "space", label: "내 공간", icon: Layers },
] as const;

type TabKey = typeof TABS[number]["key"];

interface Props {
  userId: string;
  nickname: string;
  gradeLabel: string;
  nutPoints: number;
  groupCount: number;
  projectCount: number;
  pendingCount: number;
  unreadCount?: number;
}

/* AI 빠른 명령 프리셋 — 탭 오늘에서 바로 실행 */
const QUICK_COMMANDS = [
  { label: "오늘 할 일 요약", icon: CheckSquare, cmd: "오늘 내 할 일 전체 요약해줘" },
  { label: "미팅 잡기", icon: Calendar, cmd: "내일 오후 3시 기획 미팅 잡아줘" },
  { label: "할 일 추가", icon: PenLine, cmd: "이번 주 금요일까지 LP 디자인 초안 할 일 추가" },
  { label: "너트 설계", icon: Sparkles, cmd: "20대 개발자 너트 설계해줘" },
];

export function DashboardTabs({
  userId, nickname, gradeLabel, nutPoints, groupCount, projectCount, pendingCount,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>(
    (searchParams.get("tab") as TabKey) || "today"
  );

  useEffect(() => {
    const t = searchParams.get("tab") as TabKey | null;
    if (t && TABS.some(tab => tab.key === t)) setActiveTab(t);
  }, [searchParams]);

  function switchTab(key: TabKey) {
    setActiveTab(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    router.push(url.pathname + url.search, { scroll: false });
  }

  /* AI 탭으로 이동하면서 명령어 미리 세팅 */
  function goAiWith(cmd: string) {
    switchTab("ai");
    // AICommandBar의 input을 localStorage로 전달
    try { localStorage.setItem("ai-cmdbar-prefill", cmd); } catch {}
  }

  return (
    <div>
      {/* ── Tab Bar ─────────────────────────────────────────────── */}
      <div className="border-b-[2px] border-nu-ink/[0.08] mb-6 overflow-x-auto scrollbar-hide">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 font-mono-nu text-[12px] uppercase tracking-widest border-b-[3px] transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.key
                  ? "border-nu-pink text-nu-ink font-black bg-nu-pink/[0.04]"
                  : "border-transparent text-nu-muted hover:text-nu-graphite"
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
              {tab.key === "ai" && (
                <span className="font-mono-nu text-[9px] px-1 py-0.5 bg-nu-pink text-white ml-0.5">AI</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: 오늘 ───────────────────────────────────────────── */}
      {activeTab === "today" && (
        <div className="space-y-4">

          {/* AI 브리핑 — 핵심 요약 (전체 너비) */}
          <MorningBriefing />

          {/* ── AI 빠른 실행 바 ─────────────────────────────────── */}
          <div className="bg-nu-ink border-[0px] border-nu-ink p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={12} className="text-nu-yellow" />
              <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-paper/70">AI로 바로 실행</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUICK_COMMANDS.map(q => (
                <button
                  key={q.label}
                  onClick={() => goAiWith(q.cmd)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-nu-pink text-nu-paper px-3 py-2.5 text-left transition-colors group"
                >
                  <q.icon size={11} className="shrink-0 text-nu-yellow group-hover:text-white" />
                  <span className="font-mono-nu text-[10px] uppercase tracking-widest leading-tight">{q.label}</span>
                  <ArrowRight size={9} className="ml-auto shrink-0 opacity-40 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>

          {/* ── 오늘의 핵심 2컬럼 ─────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 할 일 */}
            <div className="bg-white border border-nu-ink/[0.08]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-nu-ink/[0.06]">
                <div className="flex items-center gap-2">
                  <CheckSquare size={13} className="text-nu-pink" />
                  <span className="font-mono-nu text-[11px] uppercase tracking-widest font-bold text-nu-ink">할 일</span>
                </div>
                <button
                  onClick={() => goAiWith("오늘 내 할 일 전체 요약해줘")}
                  className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-pink transition-colors flex items-center gap-1"
                >
                  <Bot size={9} /> AI 요약
                </button>
              </div>
              <div className="p-3">
                <MyTasksWidget />
              </div>
            </div>

            {/* 이번 주 미니 달력 */}
            <div className="bg-white border border-nu-ink/[0.08]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-nu-ink/[0.06]">
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-nu-ink" />
                  <span className="font-mono-nu text-[11px] uppercase tracking-widest font-bold text-nu-ink">일정</span>
                </div>
                <button
                  onClick={() => switchTab("week")}
                  className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-pink transition-colors"
                >
                  전체 보기 →
                </button>
              </div>
              <div className="p-3">
                <MyCalendarWidget />
              </div>
            </div>
          </div>

          {/* ── 빠른 링크 + 승인 알림 ─────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { href: "/groups", label: "너트", icon: Layers, count: groupCount },
              { href: "/projects", label: "볼트", icon: Briefcase, count: projectCount },
              { href: "/members", label: "와셔", icon: Users, count: null },
              { href: "/chat", label: "채팅", icon: MessageSquare, count: null },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-2 bg-white border border-nu-ink/[0.08] px-3 py-2.5 no-underline hover:border-nu-ink/30 transition-colors group">
                <item.icon size={12} className="text-nu-pink shrink-0" />
                <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite group-hover:text-nu-ink">{item.label}</span>
                {item.count !== null && item.count > 0 && (
                  <span className="ml-auto font-mono-nu text-[10px] font-bold text-nu-pink">{item.count}</span>
                )}
                <ChevronRight size={9} className="ml-auto text-nu-muted/40 shrink-0" />
              </Link>
            ))}
          </div>

          {pendingCount > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border-[2px] border-amber-300/60 px-4 py-3">
              <Bell size={13} className="text-amber-500 shrink-0" />
              <p className="text-[13px] text-amber-800 font-medium flex-1">
                가입 승인 대기 <strong>{pendingCount}건</strong>이 있습니다.
              </p>
              <Link href="/groups" className="font-mono-nu text-[11px] uppercase tracking-widest text-amber-700 hover:text-amber-900 no-underline shrink-0">
                확인 →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: AI 어시스턴트 ──────────────────────────────────── */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          {/* 안내 배너 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: PenLine, title: "등록", desc: "미팅, 할 일, 개인 일정을\n자연어로 바로 등록" },
              { icon: Sparkles, title: "정리", desc: "내 생각을 정리하고\n너트·볼트 어디에 넣을지 제안" },
              { icon: Layers, title: "설계", desc: "새 너트·볼트 공간을\nAI가 자동 설계 생성" },
            ].map(c => (
              <div key={c.title} className="bg-nu-cream/30 border border-nu-ink/[0.08] px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <c.icon size={12} className="text-nu-pink" />
                  <span className="font-mono-nu text-[10px] uppercase tracking-widest font-bold text-nu-ink">{c.title}</span>
                </div>
                <p className="font-mono-nu text-[10px] text-nu-muted whitespace-pre-line leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>

          <AICommandBar />
        </div>
      )}

      {/* ── TAB: 이번 주 ────────────────────────────────────────── */}
      {activeTab === "week" && (
        <div className="space-y-5">
          <InlineCalendarPreview />
          <PersonalHubWidget />
        </div>
      )}

      {/* ── TAB: 내 공간 ────────────────────────────────────────── */}
      {activeTab === "space" && (
        <div className="space-y-4">
          <PersonalHubWidget />
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/groups", label: "내 너트", icon: Layers, desc: "참여 중인 그룹" },
              { href: "/projects", label: "내 볼트", icon: Briefcase, desc: "진행 중인 프로젝트" },
              { href: "/members", label: "와셔 찾기", icon: Users, desc: "팀원 검색" },
              { href: "/chat", label: "채팅", icon: MessageSquare, desc: "메시지 확인" },
              { href: "/wiki", label: "위키", icon: BookOpen, desc: "지식 저장소" },
              { href: "/resources", label: "자료실", icon: FolderOpen, desc: "파일 & 링크" },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 bg-white border border-nu-ink/[0.08] p-4 no-underline hover:border-nu-pink/40 hover:bg-nu-pink/[0.02] transition-colors group">
                <div className="w-8 h-8 bg-nu-ink/5 flex items-center justify-center shrink-0">
                  <item.icon size={14} className="text-nu-graphite group-hover:text-nu-pink transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-head text-sm font-bold text-nu-ink group-hover:text-nu-pink transition-colors">{item.label}</p>
                  <p className="font-mono-nu text-[10px] text-nu-muted">{item.desc}</p>
                </div>
                <ChevronRight size={12} className="text-nu-muted/40 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
