"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  Award, Shield, CheckCircle2, ExternalLink, Calendar, Users, 
  Briefcase, FileText, Star, TrendingUp, Zap, Share2, Copy,
  BookOpen, MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { EndorsementPanel } from "@/components/shared/endorsement-panel";

const DIMS = ["기획", "성실", "정리", "실행", "전문", "협업"];

function FullRadar({ scores, endorseCounts }: { scores: number[]; endorseCounts: number[] }) {
  const r = 80, cx = 100, cy = 100;
  const getP = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return `${cx + (r * v / 100) * Math.cos(a)},${cy + (r * v / 100) * Math.sin(a)}`;
  };

  return (
    <svg width="200" height="200" className="mx-auto">
      {[25, 50, 75, 100].map(v => (
        <polygon key={v} points={Array.from({length:6}).map((_,i)=>getP(i,v)).join(' ')} className="fill-none stroke-nu-ink/5 stroke-[0.5]" />
      ))}
      {Array.from({length:6}).map((_,i) => (
        <line key={i} x1={cx} y1={cy} x2={cx+r*Math.cos((Math.PI*2*i)/6-Math.PI/2)} y2={cy+r*Math.sin((Math.PI*2*i)/6-Math.PI/2)} className="stroke-nu-ink/5 stroke-[0.5]" />
      ))}
      <polygon points={scores.map((s,i)=>getP(i,s)).join(' ')} className="fill-nu-pink/12 stroke-nu-pink stroke-[2]" />
      {DIMS.map((label, i) => {
        const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const lx = cx + (r + 22) * Math.cos(a);
        const ly = cy + (r + 22) * Math.sin(a);
        return (
          <g key={label}>
            <text x={lx} y={ly - 5} textAnchor="middle" className="font-mono-nu text-[8px] font-black uppercase fill-nu-ink">
              {label}
            </text>
            <text x={lx} y={ly + 6} textAnchor="middle" className="font-mono-nu text-[7px] fill-nu-muted">
              {scores[i]}pt · {endorseCounts[i]}↑
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function PublicPortfolioPage() {
  const params = useParams();
  const profileId = params.profileId as string;

  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ meetings: 0, posts: 0, projects: 0, resources: 0, groups: 0 });
  const [scores, setScores] = useState<number[]>([0,0,0,0,0,0]);
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: prof } = await supabase.from("profiles").select("*").eq("id", profileId).single();
      if (!prof) { setLoading(false); return; }
      setProfile(prof);

      const [
        { count: meetingCount },
        { count: postCount },
        { count: projectCount },
        { count: resourceCount },
        { count: groupCount },
      ] = await Promise.all([
        supabase.from("meeting_attendees").select("id", { count: "exact", head: true }).eq("user_id", profileId),
        supabase.from("crew_posts").select("id", { count: "exact", head: true }).eq("author_id", profileId),
        supabase.from("project_members").select("id", { count: "exact", head: true }).eq("user_id", profileId),
        supabase.from("file_attachments").select("id", { count: "exact", head: true }).eq("uploaded_by", profileId),
        supabase.from("group_members").select("id", { count: "exact", head: true }).eq("user_id", profileId).eq("status", "active"),
      ]);

      const mc = meetingCount || 0;
      const pc = postCount || 0;
      const pj = projectCount || 0;
      const rc = resourceCount || 0;

      setStats({ meetings: mc, posts: pc, projects: pj, resources: rc, groups: groupCount || 0 });

      const s = [
        Math.min(100, mc * 12 + pj * 10),
        Math.min(100, mc * 15),
        Math.min(100, rc * 18 + pc * 5),
        Math.min(100, pj * 25 + mc * 8),
        Math.min(100, pc * 12 + pj * 15),
        Math.min(100, mc * 10 + pc * 8),
      ];
      setScores(s);

      // Award badges
      const b: string[] = [];
      if (mc >= 10) b.push("🏆 미팅 마스터");
      if (pc >= 5) b.push("✍️ 활발한 소통가");
      if (pj >= 2) b.push("🚀 프로젝트 리더");
      if (rc >= 3) b.push("📚 지식 큐레이터");
      if (s.some(v => v >= 80)) b.push("💎 전문가 인재");
      if (b.length === 0) b.push("🌱 성장 중인 인재");
      setBadges(b);

      setLoading(false);
    }
    load();
  }, [profileId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("📋 포트폴리오 링크가 클립보드에 복사되었습니다!");
  };

  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / 6);

  if (loading) {
    return (
      <div className="min-h-screen bg-nu-paper flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-20 h-20 rounded-full bg-nu-cream mx-auto mb-4" />
          <div className="h-6 bg-nu-cream w-48 mx-auto mb-2" />
          <div className="h-4 bg-nu-cream w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-nu-paper flex items-center justify-center">
        <p className="text-nu-muted">프로필을 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nu-paper">
      {/* Hero Header */}
      <div className="bg-nu-ink text-nu-paper relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-40 h-40 bg-nu-pink rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-60 h-60 bg-nu-blue rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto px-8 py-16 relative">
          <div className="flex items-center gap-2 mb-6">
            <Shield size={14} className="text-nu-pink" />
            <span className="font-mono-nu text-[9px] font-black uppercase tracking-[0.25em] text-nu-pink">
              Verified_Portfolio · nutunion.co.kr
            </span>
          </div>

          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 rounded-full bg-nu-pink text-white flex items-center justify-center font-head text-3xl font-bold border-4 border-nu-paper/20">
              {(profile.nickname || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-head text-3xl font-extrabold">{profile.nickname}</h1>
              <p className="text-nu-paper/60 text-sm mt-1">{profile.bio || "넛유니온 인증 활동가"}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            {badges.map(b => (
              <span key={b} className="font-mono-nu text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 bg-nu-paper/10 border border-nu-paper/10 text-nu-paper">
                {b}
              </span>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { icon: Calendar, value: stats.meetings, label: "미팅" },
              { icon: MessageSquare, value: stats.posts, label: "게시글" },
              { icon: Briefcase, value: stats.projects, label: "프로젝트" },
              { icon: FileText, value: stats.resources, label: "자료" },
              { icon: Users, value: stats.groups, label: "소모임" },
            ].map(s => (
              <div key={s.label} className="text-center p-3 bg-nu-paper/5 border border-nu-paper/10">
                <s.icon size={14} className="mx-auto text-nu-paper/40 mb-1" />
                <p className="font-head text-lg font-extrabold">{s.value}</p>
                <p className="font-mono-nu text-[7px] uppercase tracking-widest text-nu-paper/40">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Radar Chart */}
          <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-head text-lg font-bold text-nu-ink flex items-center gap-2">
                <TrendingUp size={18} className="text-nu-pink" /> 역량 레이더
              </h2>
              <span className="font-mono-nu text-[10px] bg-nu-pink/10 text-nu-pink px-2 py-1 font-bold uppercase">
                AVG {avgScore}pt
              </span>
            </div>
            <FullRadar scores={scores} endorseCounts={[3, 2, 1, 4, 2, 3]} />
          </div>

          {/* Endorsement */}
          <div className="space-y-4">
            <EndorsementPanel targetUserId={profileId} targetNickname={profile.nickname || "멤버"} />

            {/* Trust Mark */}
            <div className="bg-nu-ink text-nu-paper p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={16} className="text-nu-blue" />
                <span className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-blue">
                  Trust Verification
                </span>
              </div>
              <p className="text-[11px] text-nu-paper/70 leading-relaxed mb-3">
                이 데이터는 넛유니온 생태계 내 <span className="text-nu-paper font-bold">{stats.meetings + stats.posts + stats.projects + stats.resources}건</span>의 실제 활동으로 검증되었습니다.
              </p>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-green-400" />
                <span className="font-mono-nu text-[8px] text-nu-paper/50 uppercase tracking-widest">Verified by nutunion · {new Date().getFullYear()}</span>
              </div>
            </div>

            {/* Share */}
            <button
              onClick={handleCopyLink}
              className="w-full font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-3 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center justify-center gap-2"
            >
              <Share2 size={14} /> 포트폴리오 링크 공유하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
