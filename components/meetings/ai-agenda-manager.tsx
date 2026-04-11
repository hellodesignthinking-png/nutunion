"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sparkles, CheckCircle2, Circle, ArrowRight, Zap, Brain, Clipboard, Plus } from "lucide-react";
import { toast } from "sonner";

interface SuggestedItem {
  type: "carryover" | "milestone" | "follow_up" | "new";
  title: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

export function AiAgendaManager({ groupId, onAccept }: { groupId: string; onAccept?: (items: string[]) => void }) {
  const [suggestions, setSuggestions] = useState<SuggestedItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function analyze() {
      const supabase = createClient();

      // Get recent meetings with their agendas
      const { data: meetings } = await supabase
        .from("meetings")
        .select("id, title, summary, status, next_topic, scheduled_at")
        .eq("group_id", groupId)
        .order("scheduled_at", { ascending: false })
        .limit(5);

      const items: SuggestedItem[] = [];

      // 1. Carryover: incomplete action items from previous meetings
      if (meetings && meetings.length > 0) {
        const lastMeeting = meetings[0];

        if (lastMeeting.next_topic) {
          items.push({
            type: "carryover",
            title: lastMeeting.next_topic,
            reason: `이전 미팅(${new Date(lastMeeting.scheduled_at).toLocaleDateString('ko')})에서 지정된 다음 주제`,
            priority: "high",
          });
        }

        // Get unresolved issues (table may not exist if migration 009 not run)
        const issuesRes = await supabase
          .from("meeting_issues")
          .select("title, status")
          .eq("meeting_id", lastMeeting.id)
          .eq("status", "open");
        const issues = issuesRes.error ? [] : (issuesRes.data || []);

        issues.forEach((issue: any) => {
          items.push({
            type: "carryover",
            title: `[미해결] ${issue.title}`,
            reason: "이전 미팅에서 해결되지 않은 이슈",
            priority: "high",
          });
        });

        // Generate follow-ups from summary
        if (lastMeeting.summary) {
          items.push({
            type: "follow_up",
            title: "이전 미팅 결정 사항 실행 현황 점검",
            reason: `"${lastMeeting.title}" 미팅의 후속 조치 확인`,
            priority: "medium",
          });
        }
      }

      // 2. Project milestone check
      try {
        const projRes = await supabase
          .from("project_members")
          .select("project:projects(title, status)")
          .eq("status", "active")
          .limit(3);
        const projects = projRes.error ? null : projRes.data;

        if (projects && projects.length > 0) {
          items.push({
            type: "milestone",
            title: "프로젝트 마일스톤 진행 현황 공유",
            reason: `소모임원이 참여 중인 ${projects.length}개 프로젝트 상태 점검`,
            priority: "medium",
          });
        }
      } catch { /* project_members FK join may not be available */ }

      // 3. Weekly digest suggested agendas
      try {
        const { data: digestData } = await supabase
          .from("wiki_ai_analyses")
          .select("content")
          .eq("group_id", groupId)
          .eq("analysis_type", "weekly_digest")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (digestData?.content) {
          try {
            const parsed = JSON.parse(digestData.content);
            if (Array.isArray(parsed.suggestedAgenda)) {
              parsed.suggestedAgenda.forEach((agenda: string) => {
                items.push({
                  type: "follow_up",
                  title: agenda,
                  reason: "주간 다이제스트 AI가 제안한 안건",
                  priority: "medium",
                });
              });
            }
            // Add carry-over items as high priority
            if (Array.isArray(parsed.carryOverItems)) {
              parsed.carryOverItems.slice(0, 3).forEach((item: string) => {
                items.push({
                  type: "carryover",
                  title: `[이월] ${item}`,
                  reason: "주간 다이제스트에서 이월된 미완료 항목",
                  priority: "high",
                });
              });
            }
          } catch { /* ignore parse errors */ }
        }
      } catch { /* wiki_ai_analyses table may not exist */ }

      // 4. Always suggest these standard items
      items.push({
        type: "new",
        title: "자유 발언 & 아이디어 브레인스토밍",
        reason: "팀 내 소통과 창의적 아이디어 도출을 위한 시간",
        priority: "low",
      });

      items.push({
        type: "new",
        title: "다음 미팅 일정 및 역할 확정",
        reason: "지속적인 운영을 위한 정기 아젠다",
        priority: "low",
      });

      setSuggestions(items);
      // Auto-select high priority items
      const autoSelect = new Set<number>();
      items.forEach((item, idx) => {
        if (item.priority === "high") autoSelect.add(idx);
      });
      setSelectedItems(autoSelect);
      setLoading(false);
    }
    analyze();
  }, [groupId]);

  const toggleItem = (idx: number) => {
    const next = new Set(selectedItems);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setSelectedItems(next);
  };

  const handleAccept = () => {
    const accepted = [...selectedItems].map(i => suggestions[i].title);
    if (onAccept) onAccept(accepted);
    toast.success(`✅ ${accepted.length}개의 아젠다가 적용되었습니다!`);
  };

  const priorityBadge = {
    high: { label: "HIGH", color: "bg-nu-pink/10 text-nu-pink border-nu-pink/20" },
    medium: { label: "MED", color: "bg-nu-amber/10 text-nu-amber border-nu-amber/20" },
    low: { label: "LOW", color: "bg-nu-muted/10 text-nu-muted border-nu-muted/20" },
  };

  const typeIcon = {
    carryover: { icon: ArrowRight, label: "이월", color: "text-nu-pink" },
    milestone: { icon: Zap, label: "마일스톤", color: "text-nu-blue" },
    follow_up: { icon: Clipboard, label: "후속", color: "text-nu-amber" },
    new: { icon: Plus, label: "신규", color: "text-nu-muted" },
  };

  if (loading) {
    return (
      <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-6">
        <div className="flex items-center gap-3 mb-4">
          <Brain size={20} className="text-nu-pink animate-pulse" />
          <div>
            <p className="font-head text-sm font-bold text-nu-ink">AI가 아젠다를 분석하고 있습니다...</p>
            <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">Analyzing previous meetings & milestones</p>
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-nu-cream/30 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-nu-ink to-nu-ink/90 text-nu-paper px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-nu-pink" />
          <span className="font-mono-nu text-[9px] font-black uppercase tracking-[0.25em] text-nu-pink">
            AI_Agenda_Manager
          </span>
        </div>
        <p className="text-[11px] text-nu-paper/60">
          이전 미팅과 프로젝트 현황을 분석하여 최적의 아젠다를 제안합니다
        </p>
      </div>

      {/* Suggestions */}
      <div className="divide-y divide-nu-ink/5">
        {suggestions.map((item, idx) => {
          const isSelected = selectedItems.has(idx);
          const badge = priorityBadge[item.priority];
          const type = typeIcon[item.type];
          const TypeIcon = type.icon;
          
          return (
            <button
              key={idx}
              onClick={() => toggleItem(idx)}
              className={`w-full text-left px-5 py-3.5 flex items-start gap-3 transition-all hover:bg-nu-cream/20 ${
                isSelected ? "bg-nu-blue/[0.03]" : ""
              }`}
            >
              <div className="mt-0.5">
                {isSelected
                  ? <CheckCircle2 size={16} className="text-nu-blue" />
                  : <Circle size={16} className="text-nu-muted/30" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <TypeIcon size={10} className={type.color} />
                  <span className={`font-mono-nu text-[7px] font-bold uppercase tracking-widest ${type.color}`}>
                    {type.label}
                  </span>
                  <span className={`font-mono-nu text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>
                <p className={`text-[12px] font-bold ${isSelected ? "text-nu-ink" : "text-nu-muted"}`}>
                  {item.title}
                </p>
                <p className="text-[10px] text-nu-muted mt-0.5">{item.reason}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Action */}
      <div className="px-5 py-4 bg-nu-cream/15 border-t border-nu-ink/5 flex items-center justify-between">
        <span className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">
          {selectedItems.size}/{suggestions.length} selected
        </span>
        <button
          onClick={handleAccept}
          disabled={selectedItems.size === 0}
          className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-all disabled:opacity-30 flex items-center gap-2"
        >
          <Sparkles size={12} /> 아젠다 적용하기
        </button>
      </div>
    </div>
  );
}
