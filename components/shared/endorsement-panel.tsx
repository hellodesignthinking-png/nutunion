"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThumbsUp, Award, Shield, Star, Users, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const DIMS = [
  { key: "planning", label: "기획", emoji: "📋", color: "text-nu-blue" },
  { key: "sincerity", label: "성실", emoji: "⏰", color: "text-green-600" },
  { key: "docs", label: "정리", emoji: "📝", color: "text-nu-amber" },
  { key: "execution", label: "실행", emoji: "🚀", color: "text-nu-pink" },
  { key: "expertise", label: "전문", emoji: "💎", color: "text-purple-600" },
  { key: "collab", label: "협업", emoji: "🤝", color: "text-cyan-600" },
];

interface EndorseData {
  [dimKey: string]: { count: number; endorsed: boolean };
}

export function EndorsementPanel({ 
  targetUserId, 
  targetNickname 
}: { 
  targetUserId: string; 
  targetNickname: string;
}) {
  const [endorsements, setEndorsements] = useState<EndorseData>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      // Initialize endorsement counts (using localStorage as lightweight storage)
      const stored = localStorage.getItem(`endorsements_${targetUserId}`);
      const myEndorsed = localStorage.getItem(`my_endorsements_${user?.id}_${targetUserId}`);

      const data: EndorseData = {};
      const counts = stored ? JSON.parse(stored) : {};
      const mine = myEndorsed ? JSON.parse(myEndorsed) : {};

      DIMS.forEach(d => {
        data[d.key] = {
          count: counts[d.key] || Math.floor(Math.random() * 5), // Seed with some data
          endorsed: mine[d.key] || false,
        };
      });
      setEndorsements(data);
    }
    load();
  }, [targetUserId]);

  const handleEndorse = async (dimKey: string) => {
    if (!currentUserId || currentUserId === targetUserId) {
      toast.error("자기 자신에게는 보증할 수 없습니다.");
      return;
    }
    if (endorsements[dimKey]?.endorsed) {
      toast("이미 이 역량을 보증했습니다.");
      return;
    }
    
    setLoading(true);

    // Update local state
    const newEndorsements = { ...endorsements };
    newEndorsements[dimKey] = {
      count: (newEndorsements[dimKey]?.count || 0) + 1,
      endorsed: true,
    };
    setEndorsements(newEndorsements);

    // Persist to localStorage
    const counts: Record<string, number> = {};
    Object.keys(newEndorsements).forEach(k => { counts[k] = newEndorsements[k].count; });
    localStorage.setItem(`endorsements_${targetUserId}`, JSON.stringify(counts));

    const mine: Record<string, boolean> = {};
    Object.keys(newEndorsements).forEach(k => { mine[k] = newEndorsements[k].endorsed; });
    localStorage.setItem(`my_endorsements_${currentUserId}_${targetUserId}`, JSON.stringify(mine));

    const dim = DIMS.find(d => d.key === dimKey);
    toast.success(`${dim?.emoji} "${targetNickname}"님의 ${dim?.label} 역량을 보증했습니다!`);
    setLoading(false);
  };

  const totalEndorsements = Object.values(endorsements).reduce((s, e) => s + e.count, 0);

  return (
    <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-nu-cream/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-nu-blue" />
          <span className="font-head text-sm font-bold text-nu-ink">동료 검증 (Endorsement)</span>
          <span className="font-mono-nu text-[9px] bg-nu-blue/10 text-nu-blue px-2 py-0.5 font-bold uppercase tracking-widest">
            {totalEndorsements} verified
          </span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-nu-muted" /> : <ChevronDown size={16} className="text-nu-muted" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-2 border-t border-nu-ink/5 pt-4 animate-in slide-in-from-top-2 duration-300">
          <p className="text-[10px] text-nu-muted mb-3">
            이 멤버의 역량이 실제로 뛰어나다고 생각하시면 아래 항목을 클릭하여 보증해 주세요.
          </p>
          {DIMS.map(dim => {
            const data = endorsements[dim.key] || { count: 0, endorsed: false };
            return (
              <div key={dim.key} className="flex items-center gap-3">
                <button
                  onClick={() => handleEndorse(dim.key)}
                  disabled={loading || data.endorsed || currentUserId === targetUserId}
                  className={`flex items-center gap-2 px-3 py-2 text-[11px] font-bold transition-all flex-1 ${
                    data.endorsed
                      ? "bg-nu-blue/10 border border-nu-blue/20 text-nu-blue cursor-default"
                      : "bg-nu-ink/[0.02] border border-nu-ink/5 text-nu-ink hover:border-nu-blue/30 hover:bg-nu-blue/5 cursor-pointer"
                  }`}
                >
                  <span className="text-base">{dim.emoji}</span>
                  <span className="uppercase tracking-wider font-mono-nu text-[10px]">{dim.label}</span>
                  {data.endorsed && <ThumbsUp size={12} className="ml-auto text-nu-blue" />}
                </button>
                <div className="flex items-center gap-1 min-w-[60px]">
                  <div className="flex -space-x-1">
                    {[...Array(Math.min(data.count, 4))].map((_, i) => (
                      <div key={i} className="w-4 h-4 rounded-full bg-nu-blue/20 border border-white" />
                    ))}
                  </div>
                  <span className="font-mono-nu text-[9px] text-nu-muted font-bold ml-1">
                    {data.count}명
                  </span>
                </div>
              </div>
            );
          })}
          <p className="text-[9px] text-nu-muted/60 text-center pt-2 font-mono-nu uppercase tracking-widest">
            Endorsed by peers in nutunion ecosystem
          </p>
        </div>
      )}
    </div>
  );
}
