"use client";

/**
 * SlashCommands — 채팅 입력창에서 `/` 입력 시 뜨는 명령어 팔레트.
 *
 * 지원 명령어 (맥락 의존):
 *  - /일정 [제목]       → 일정 생성 페이지 (그룹/볼트 맥락 유지, 제목 prefill)
 *  - /할일 [제목]       → 태스크 생성 (볼트에서만)
 *  - /자료              → 자료실 페이지
 *  - /탭                → 탭(회고) 페이지
 *  - /멤버              → 멤버 목록
 *  - /설정              → 설정 페이지
 *  - /help 또는 /?      → 명령어 목록
 *
 * 동작:
 *  - 채팅 draft 가 "/" 로 시작하고 추가 문자 입력 시 이 컴포넌트가 매칭되는 명령어 suggest
 *  - Enter / 클릭 → onExecute(명령어, 인자) 호출 → 실행 후 draft 비움
 *  - Esc → 팔레트 닫기
 */

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, CheckSquare, FolderOpen, FileText, Users, Settings, HelpCircle, Megaphone, BarChart3 } from "lucide-react";
import { encodeAction } from "@/lib/chat/chat-actions";

export interface SlashCommand {
  key: string;
  aliases: string[];
  label: string;
  description: string;
  icon: React.ReactNode;
  /** 볼트 전용 / 너트 전용 / 공용 */
  contexts: Array<"group" | "project" | "any">;
  /** 실행 시 이동할 경로 (인자 처리 콜백) */
  execute: (ctx: { groupId?: string | null; projectId?: string | null; arg?: string; router: any }) => void;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    key: "일정",
    aliases: ["/일정", "/schedule", "/meeting", "/미팅"],
    label: "/일정",
    description: "일정/미팅 만들기",
    icon: <Calendar size={14} className="text-[#0EA5E9]" />,
    contexts: ["group", "project"],
    execute: ({ groupId, projectId, arg, router }) => {
      const qs = arg ? `?title=${encodeURIComponent(arg)}` : "";
      if (groupId) router.push(`/groups/${groupId}/schedule${qs}`);
      else if (projectId) router.push(`/projects/${projectId}${qs}`);
    },
  },
  {
    key: "할일",
    aliases: ["/할일", "/task", "/todo", "/태스크"],
    label: "/할일",
    description: "태스크 추가 (볼트)",
    icon: <CheckSquare size={14} className="text-[#22C55E]" />,
    contexts: ["project"],
    execute: ({ projectId, arg, router }) => {
      const qs = arg ? `?task=${encodeURIComponent(arg)}` : "";
      if (projectId) router.push(`/projects/${projectId}${qs}`);
    },
  },
  {
    key: "자료",
    aliases: ["/자료", "/resources", "/files", "/자료실"],
    label: "/자료",
    description: "자료실 열기",
    icon: <FolderOpen size={14} className="text-[#14B8A6]" />,
    contexts: ["group", "project"],
    execute: ({ groupId, projectId, router }) => {
      if (groupId) router.push(`/groups/${groupId}/resources`);
      else if (projectId) router.push(`/projects/${projectId}`);
    },
  },
  {
    key: "탭",
    aliases: ["/탭", "/tap", "/wiki"],
    label: "/탭",
    description: "탭 (회고/기록)",
    icon: <FileText size={14} className="text-[#F59E0B]" />,
    contexts: ["group", "project"],
    execute: ({ groupId, projectId, router }) => {
      if (groupId) router.push(`/groups/${groupId}/wiki`);
      else if (projectId) router.push(`/projects/${projectId}`);
    },
  },
  {
    key: "멤버",
    aliases: ["/멤버", "/members", "/사람"],
    label: "/멤버",
    description: "멤버 목록",
    icon: <Users size={14} className="text-nu-pink" />,
    contexts: ["group", "project"],
    execute: ({ groupId, projectId, router }) => {
      if (groupId) router.push(`/groups/${groupId}`);
      else if (projectId) router.push(`/projects/${projectId}`);
    },
  },
  {
    key: "설정",
    aliases: ["/설정", "/settings", "/config"],
    label: "/설정",
    description: "그룹/볼트 설정",
    icon: <Settings size={14} className="text-nu-graphite" />,
    contexts: ["group", "project"],
    execute: ({ groupId, projectId, router }) => {
      if (groupId) router.push(`/groups/${groupId}/settings`);
      else if (projectId) router.push(`/projects/${projectId}/settings`);
    },
  },
  {
    key: "공지",
    aliases: ["/공지", "/announce", "/notice", "/announcement"],
    label: "/공지 [!|!!] [내용]",
    description: "공지 등록 (! = 경고, !! = 긴급)",
    icon: <Megaphone size={14} className="text-nu-pink" />,
    contexts: ["group", "project"],
    execute: async ({ groupId, projectId, arg }) => {
      const raw = (arg || "").trim();
      if (!raw) {
        toast.error("공지 내용을 입력하세요 — 예: /공지 내일 회의 30분 지연  (!중요 / !!긴급 prefix 가능)");
        return;
      }
      // severity 파싱 — 맨 앞 "!!", "!" 또는 [urgent]/[warning] 토큰
      let severity: "info" | "warning" | "urgent" = "info";
      let text = raw;
      if (/^!!\s*/.test(text)) {
        severity = "urgent";
        text = text.replace(/^!!\s*/, "");
      } else if (/^!\s*/.test(text)) {
        severity = "warning";
        text = text.replace(/^!\s*/, "");
      } else if (/^\[urgent\]\s*/i.test(text)) {
        severity = "urgent";
        text = text.replace(/^\[urgent\]\s*/i, "");
      } else if (/^\[warning\]\s*/i.test(text)) {
        severity = "warning";
        text = text.replace(/^\[warning\]\s*/i, "");
      }
      if (!text.trim()) {
        toast.error("공지 내용이 비었어요");
        return;
      }
      const content = encodeAction({ type: "announcement", pinned: true, severity }, text);
      try {
        const res = await fetch("/api/chat/system-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            groupId ? { group_id: groupId, content, ensure_room: true }
                    : { project_id: projectId, content, ensure_room: true },
          ),
        });
        if (!res.ok) throw new Error((await res.json()).error || "실패");
        const j = await res.json();
        // 공지는 자동으로 상단 고정
        if (j.message_id && j.room_id) {
          fetch(`/api/chat/rooms/${j.room_id}/pins`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message_id: j.message_id }),
          }).catch(() => {});
        }
        toast.success("공지가 등록되고 상단 고정됐어요 📌");
      } catch (e: any) {
        toast.error(e.message || "공지 등록 실패");
      }
    },
  },
  {
    key: "투표",
    aliases: ["/투표", "/poll", "/vote"],
    label: "/투표 질문? 옵션1 / 옵션2",
    description: "투표 시작 (옵션을 / 로 구분)",
    icon: <BarChart3 size={14} className="text-[#9333EA]" />,
    contexts: ["group", "project"],
    execute: async ({ groupId, projectId, arg }) => {
      const raw = (arg || "").trim();
      if (!raw) {
        toast.error("형식: /투표 질문? 옵션1 / 옵션2 / 옵션3  (마감: 맨 뒤에 30m / 2h / 1d 추가)");
        return;
      }
      // 끝에 30m/2h/1d 형식이 있으면 closes_at 계산 후 제거
      let closesAt: string | null = null;
      const durMatch = raw.match(/\s+(\d+)\s*(m|h|d)\s*$/i);
      let body = raw;
      if (durMatch) {
        const n = parseInt(durMatch[1], 10);
        const unit = durMatch[2].toLowerCase();
        const mult = unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
        closesAt = new Date(Date.now() + n * mult).toISOString();
        body = raw.slice(0, raw.length - durMatch[0].length).trim();
      }
      // "질문? A / B / C" 파싱
      const qIdx = body.indexOf("?");
      let question = "";
      let rest = body;
      if (qIdx >= 0) {
        question = body.slice(0, qIdx + 1).trim();
        rest = body.slice(qIdx + 1).trim();
      } else {
        const parts = body.split("/");
        question = parts.shift()?.trim() || body;
        rest = parts.join("/").trim();
      }
      const options = rest
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean);
      if (options.length < 2) {
        toast.error("옵션은 최소 2개 필요 — / 로 구분하세요");
        return;
      }
      if (options.length > 6) {
        toast.error("옵션은 최대 6개까지");
        return;
      }
      try {
        // 1) 현재 방 조회 (room_id 필요)
        const body: any = groupId ? { group_id: groupId } : { project_id: projectId };
        const rRes = await fetch("/api/chat/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const rJson = await rRes.json();
        const roomId = rJson?.room_id;
        if (!roomId) throw new Error("채팅방을 찾을 수 없어요");

        // 2) polls 레코드 생성 (실패 시 local-only fallback)
        let poll_id: string | undefined;
        try {
          const pollRes = await fetch("/api/polls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              room_id: roomId,
              question,
              options,
              closes_at: closesAt,
            }),
          });
          if (pollRes.ok) {
            poll_id = (await pollRes.json()).poll_id;
          }
        } catch {}

        // 3) 시스템 메시지 (poll_id 가 있으면 실시간 집계, 없으면 local-only)
        const content = encodeAction(
          { type: "poll", question, options, poll_id, closes_at: closesAt || undefined } as any,
          closesAt
            ? `${question}  ⏰ ${new Date(closesAt).toLocaleString("ko", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 마감`
            : question,
        );
        const sysRes = await fetch("/api/chat/system-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            groupId ? { group_id: groupId, content, ensure_room: true }
                    : { project_id: projectId, content, ensure_room: true },
          ),
        });
        if (!sysRes.ok) throw new Error((await sysRes.json()).error || "실패");
        toast.success(poll_id ? "투표가 시작됐어요 📊 (실시간 집계)" : "투표 카드 등록 (로컬 표시)");
      } catch (e: any) {
        toast.error(e.message || "투표 등록 실패");
      }
    },
  },
  {
    key: "help",
    aliases: ["/help", "/?", "/도움"],
    label: "/help",
    description: "명령어 목록",
    icon: <HelpCircle size={14} className="text-nu-muted" />,
    contexts: ["any"],
    execute: () => {
      /* 팔레트가 이미 목록을 보여주므로 no-op */
    },
  },
];

/** draft 에서 `/명령 인자` 파싱 */
export function parseSlashInput(draft: string): { cmd: string; arg: string } | null {
  if (!draft.startsWith("/")) return null;
  const spaceIdx = draft.indexOf(" ");
  if (spaceIdx < 0) return { cmd: draft, arg: "" };
  return { cmd: draft.slice(0, spaceIdx), arg: draft.slice(spaceIdx + 1).trim() };
}

export interface SlashCommandsPaletteProps {
  draft: string;
  groupId?: string | null;
  projectId?: string | null;
  /** 실행 후 draft 를 비우기 위한 콜백 */
  onExecuted: () => void;
}

export function SlashCommandsPalette({
  draft,
  groupId,
  projectId,
  onExecuted,
}: SlashCommandsPaletteProps) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);

  const parsed = parseSlashInput(draft);
  const query = parsed?.cmd || "";

  const matches = useMemo(() => {
    if (!query) return [];
    const ctx = groupId ? "group" : projectId ? "project" : "any";
    return SLASH_COMMANDS.filter((c) => {
      if (!c.contexts.includes("any") && !c.contexts.includes(ctx as any)) return false;
      const q = query.toLowerCase();
      return c.aliases.some((a) => a.toLowerCase().startsWith(q));
    });
  }, [query, groupId, projectId]);

  // Enter 로 첫 번째 매칭 실행
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!parsed) return;
      if (e.key === "Enter" && matches.length > 0 && !e.shiftKey) {
        e.preventDefault();
        const first = matches[0];
        first.execute({ groupId, projectId, arg: parsed.arg || undefined, router });
        onExecuted();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [matches, parsed, groupId, projectId, router, onExecuted]);

  if (!parsed || matches.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-2 right-2 mb-2 bg-white border border-nu-ink/15 rounded-xl shadow-lg p-1 max-h-[260px] overflow-auto z-20 chat-system-font"
    >
      <div className="px-3 py-1.5 text-[10px] font-mono-nu text-nu-muted uppercase tracking-widest border-b border-nu-ink/5 mb-1">
        슬래시 명령어 · {matches.length}개 매칭
      </div>
      {matches.map((c) => (
        <button
          key={c.key}
          onClick={() => {
            c.execute({ groupId, projectId, arg: parsed.arg || undefined, router });
            onExecuted();
          }}
          className="w-full text-left flex items-start gap-2.5 px-3 py-2 hover:bg-nu-ink/5 rounded-lg transition-colors"
        >
          <span className="mt-0.5">{c.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[13px] font-semibold text-nu-ink">{c.label}</div>
            <div className="text-[11px] text-nu-graphite">{c.description}</div>
          </div>
          {parsed.arg && c.aliases.some((a) => a.toLowerCase() === parsed.cmd.toLowerCase()) && (
            <span className="shrink-0 px-2 py-0.5 bg-nu-pink/10 text-nu-pink text-[10px] rounded-full font-medium">
              ↵ {parsed.arg}
            </span>
          )}
        </button>
      ))}
      <div className="px-3 py-1.5 mt-1 text-[10px] text-nu-muted border-t border-nu-ink/5">
        Enter 로 실행 · Esc 로 취소
      </div>
    </div>
  );
}
