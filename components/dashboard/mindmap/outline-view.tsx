"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Users, Briefcase, Calendar, AlertTriangle, BookOpen, File as FileIcon, User } from "lucide-react";
import type { MindMapData } from "@/lib/dashboard/mindmap-types";
import { NODE_COLORS } from "@/lib/dashboard/mindmap-types";

interface Props {
  data: MindMapData;
  /** 노드 제목 클릭 시 — 부모가 radial 뷰로 전환하고 그 노드를 선택 + 카메라 fitView */
  onJumpToNode: (nodeId: string) => void;
}

/**
 * Outline 뷰 — 마인드맵을 계층 텍스트 트리로 표시.
 *
 * 구조:
 *   📂 너트 (그룹)
 *     ├── 너트1
 *     │   ├── 📚 위키 탭들
 *     │   ├── 👥 와셔들
 *     │   └── 📅 일정들
 *   📂 볼트 (프로젝트)
 *     ├── 볼트1
 *     │   ├── 👥 와셔들
 *     │   ├── 📎 파일들
 *     │   └── ⚠ 이슈들
 *   📂 미소속
 *     ├── 미소속 와셔
 *     ├── 미소속 일정
 *
 * - 표시는 한 화면에 다 — 빠르게 스캔/공유/읽기 용도.
 * - 항목 클릭 → onJumpToNode → radial 뷰로 전환 + 그 노드 fitView.
 */
export function OutlineView({ data, onJumpToNode }: Props) {
  const [expandedNuts, setExpandedNuts] = useState<Set<string>>(() => new Set(data.nuts.map((n) => n.id)));
  const [expandedBolts, setExpandedBolts] = useState<Set<string>>(() => new Set(data.bolts.map((b) => b.id)));

  const toggleNut = (id: string) =>
    setExpandedNuts((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const toggleBolt = (id: string) =>
    setExpandedBolts((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  // unaffiliated — 어느 너트/볼트에도 안 매핑된 워셔/일정/이슈
  const unaffWashers = data.washers.filter((w) => w.nutIds.length === 0 && w.boltIds.length === 0);
  const unaffSchedule = data.schedule.filter((s) => !s.groupId || !data.nuts.some((n) => n.id === s.groupId));
  const unaffIssues = data.issues.filter((i) => !i.projectId || !data.bolts.some((b) => b.id === i.projectId));

  return (
    <div className="w-full h-full overflow-auto bg-nu-paper px-4 py-3">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* 너트 트리 */}
        <Section
          icon={<Users size={14} className="text-nu-pink" />}
          label={`너트 · 그룹 ${data.nuts.length}`}
        >
          {data.nuts.length === 0 && <Empty>가입한 너트 없음</Empty>}
          {data.nuts.map((n) => {
            const isExpanded = expandedNuts.has(n.id);
            const topics = data.topics.filter((t) => t.groupId === n.id);
            const washers = data.washers.filter((w) => w.nutIds.includes(n.id));
            const schedule = data.schedule.filter((s) => s.groupId === n.id);
            const childCount = topics.length + washers.length + schedule.length;
            return (
              <div key={n.id} className="border-l-[3px] border-nu-pink/40 pl-2">
                <div className="flex items-center gap-1">
                  <Toggle expanded={isExpanded} onClick={() => toggleNut(n.id)} hidden={childCount === 0} />
                  <NodeButton
                    onClick={() => onJumpToNode(`nut-${n.id}`)}
                    kindStyle={NODE_COLORS.nut}
                    label={n.name}
                    sub={n.role === "host" ? "👑 호스트" : n.role === "moderator" ? "🛠 운영" : "멤버"}
                  />
                  <span className="font-mono-nu text-[9px] text-nu-muted">{childCount}</span>
                </div>
                {isExpanded && childCount > 0 && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    {topics.map((t) => (
                      <NodeRow
                        key={t.id}
                        icon={<BookOpen size={10} className="text-sky-700" />}
                        label={t.name}
                        sub="위키 탭"
                        onClick={() => onJumpToNode(`topic-${t.id}`)}
                      />
                    ))}
                    {washers.map((w) => (
                      <NodeRow
                        key={w.id}
                        icon={<User size={10} className="text-violet-700" />}
                        label={w.nickname}
                        sub={`동료 · ${w.nutIds.length}너트 ${w.boltIds.length}볼트`}
                        onClick={() => onJumpToNode(`washer-${w.id}`)}
                      />
                    ))}
                    {schedule.map((s) => (
                      <NodeRow
                        key={s.id}
                        icon={<Calendar size={10} className="text-emerald-700" />}
                        label={s.title}
                        sub={new Date(s.at).toLocaleString("ko", {
                          month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
                        })}
                        onClick={() => onJumpToNode(`sched-${s.id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Section>

        {/* 볼트 트리 */}
        <Section
          icon={<Briefcase size={14} className="text-nu-amber" />}
          label={`볼트 · 프로젝트 ${data.bolts.length}`}
        >
          {data.bolts.length === 0 && <Empty>진행 중인 볼트 없음</Empty>}
          {data.bolts.map((b) => {
            const isExpanded = expandedBolts.has(b.id);
            const washers = data.washers.filter((w) => w.boltIds.includes(b.id));
            const files = data.files.filter((f) => f.projectId === b.id);
            const issues = data.issues.filter((i) => i.projectId === b.id);
            const childCount = washers.length + files.length + issues.length;
            return (
              <div key={b.id} className="border-l-[3px] border-nu-amber/40 pl-2">
                <div className="flex items-center gap-1">
                  <Toggle expanded={isExpanded} onClick={() => toggleBolt(b.id)} hidden={childCount === 0} />
                  <NodeButton
                    onClick={() => onJumpToNode(`bolt-${b.id}`)}
                    kindStyle={NODE_COLORS.bolt}
                    label={b.title}
                    sub={b.daysLeft != null ? (b.daysLeft >= 0 ? `D-${b.daysLeft}` : `${-b.daysLeft}일 지남`) : b.status}
                  />
                  <span className="font-mono-nu text-[9px] text-nu-muted">{childCount}</span>
                </div>
                {isExpanded && childCount > 0 && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    {issues.map((i) => (
                      <NodeRow
                        key={i.id}
                        icon={<AlertTriangle size={10} className="text-red-700" />}
                        label={i.title}
                        sub={i.kind === "overdue_task" ? "마감 지남" : "멘션"}
                        onClick={() => onJumpToNode(`issue-${i.id}`)}
                      />
                    ))}
                    {washers.map((w) => (
                      <NodeRow
                        key={w.id}
                        icon={<User size={10} className="text-violet-700" />}
                        label={w.nickname}
                        sub="동료"
                        onClick={() => onJumpToNode(`washer-${w.id}`)}
                      />
                    ))}
                    {files.map((f) => (
                      <NodeRow
                        key={f.id}
                        icon={<FileIcon size={10} className="text-stone-700" />}
                        label={f.name}
                        sub={f.fileType || "파일"}
                        onClick={() => onJumpToNode(`file-${f.id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Section>

        {/* 미소속 entity */}
        {(unaffWashers.length + unaffSchedule.length + unaffIssues.length) > 0 && (
          <Section
            icon={<span className="text-nu-muted text-[12px]">○</span>}
            label="미소속"
          >
            {unaffSchedule.map((s) => (
              <NodeRow
                key={s.id}
                icon={<Calendar size={10} className="text-emerald-700" />}
                label={s.title}
                sub={new Date(s.at).toLocaleString("ko", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                onClick={() => onJumpToNode(`sched-${s.id}`)}
              />
            ))}
            {unaffIssues.map((i) => (
              <NodeRow
                key={i.id}
                icon={<AlertTriangle size={10} className="text-red-700" />}
                label={i.title}
                sub={i.kind === "overdue_task" ? "마감 지남" : "멘션"}
                onClick={() => onJumpToNode(`issue-${i.id}`)}
              />
            ))}
            {unaffWashers.map((w) => (
              <NodeRow
                key={w.id}
                icon={<User size={10} className="text-violet-700" />}
                label={w.nickname}
                sub="동료"
                onClick={() => onJumpToNode(`washer-${w.id}`)}
              />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="border-[3px] border-nu-ink bg-white shadow-[3px_3px_0_0_#0D0F14]">
      <div className="flex items-center gap-2 px-3 py-2 border-b-[2px] border-nu-ink bg-nu-cream/40">
        {icon}
        <h3 className="font-head text-[13px] font-extrabold text-nu-ink">{label}</h3>
      </div>
      <div className="p-2 space-y-1.5">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-nu-muted italic px-1">{children}</div>;
}

function Toggle({ expanded, onClick, hidden }: { expanded: boolean; onClick: () => void; hidden?: boolean }) {
  if (hidden) return <span className="w-3" aria-hidden />;
  return (
    <button type="button" onClick={onClick} className="text-nu-muted hover:text-nu-ink p-0.5" aria-label={expanded ? "접기" : "펼치기"}>
      {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
    </button>
  );
}

function NodeButton({
  onClick,
  kindStyle,
  label,
  sub,
}: {
  onClick: () => void;
  kindStyle: typeof NODE_COLORS["nut"];
  label: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-left flex items-center gap-2 px-2 py-1 ${kindStyle.bg} ${kindStyle.ink} border-[2px] ${kindStyle.border} hover:shadow-[2px_2px_0_0_#0D0F14] transition-shadow`}
    >
      <span className="font-bold text-[12px] truncate">{label}</span>
      {sub && <span className="font-mono-nu text-[9px] uppercase tracking-widest opacity-70 truncate">{sub}</span>}
    </button>
  );
}

function NodeRow({
  icon,
  label,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-nu-cream rounded-none"
    >
      <span className="shrink-0">{icon}</span>
      <span className="text-[11.5px] text-nu-ink truncate">{label}</span>
      {sub && <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted shrink-0">{sub}</span>}
    </button>
  );
}
