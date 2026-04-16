"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Award, Shield, CheckCircle2, ExternalLink, Calendar, Users,
  Briefcase, FileText, Star, TrendingUp, Zap, Share2, Copy,
  BookOpen, MessageSquare, Download, Folder, Printer, Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { EndorsementPanel } from "@/components/shared/endorsement-panel";

const DIMS = ["기획", "성실", "정리", "실행", "전문", "협업"];

// Category color map
const CATEGORY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  project: { bg: "bg-blue-100", text: "text-blue-700", icon: "🗂️" },
  work: { bg: "bg-green-100", text: "text-green-700", icon: "💼" },
  education: { bg: "bg-purple-100", text: "text-purple-700", icon: "🎓" },
  writing: { bg: "bg-orange-100", text: "text-orange-700", icon: "✍️" },
  design: { bg: "bg-pink-100", text: "text-pink-700", icon: "🎨" },
  other: { bg: "bg-gray-100", text: "text-gray-700", icon: "📌" },
};

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
            <text x={lx} y={ly - 5} textAnchor="middle" className="font-mono-nu text-[10px] font-black uppercase fill-nu-ink">
              {label}
            </text>
            <text x={lx} y={ly + 6} textAnchor="middle" className="font-mono-nu text-[9px] fill-nu-muted">
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
  const [endorseCounts, setEndorseCounts] = useState<number[]>([0,0,0,0,0,0]);
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<string[]>([]);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [timelineItems, setTimelineItems] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: prof } = await supabase.from("profiles").select("id, nickname, avatar_url, bio, grade, interests, created_at, updated_at").eq("id", profileId).single();
      if (!prof) { setLoading(false); return; }
      setProfile(prof);

      const [
        { count: meetingCount },
        { count: postCount },
        { count: projectCount },
        { count: resourceCount },
        { count: groupCount },
      ] = await Promise.all([
        supabase.from("meeting_notes").select("meeting_id", { count: "exact", head: true }).eq("created_by", profileId),
        supabase.from("crew_posts").select("id", { count: "exact", head: true }).eq("author_id", profileId),
        supabase.from("project_members").select("user_id", { count: "exact", head: true }).eq("user_id", profileId),
        supabase.from("file_attachments").select("id", { count: "exact", head: true }).eq("uploaded_by", profileId),
        supabase.from("group_members").select("user_id", { count: "exact", head: true }).eq("user_id", profileId).eq("status", "active"),
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
      if (pj >= 2) b.push("🚀 볼트 리더");
      if (rc >= 3) b.push("📚 지식 큐레이터");
      if (s.some(v => v >= 80)) b.push("💎 전문 와셔");
      if (b.length === 0) b.push("🌱 성장 중인 와셔");
      setBadges(b);

      // Load portfolio items
      try {
        const { data: portfolioData } = await supabase
          .from("portfolios")
          .select("*")
          .eq("user_id", profileId)
          .in("source", ["self", "nutunion"])
          .order("started_at", { ascending: false, nullsFirst: false });
        setPortfolios(portfolioData || []);
      } catch (e) {
        setPortfolios([]);
      }

      // Load endorsement counts per dimension
      try {
        const dims = ["leadership", "communication", "knowledge", "execution", "collaboration", "reliability"];
        const { data: endorseData } = await supabase
          .from("endorsements")
          .select("dimension")
          .eq("target_user_id", profileId);
        if (endorseData) {
          const counts = dims.map(d => endorseData.filter((e: any) => e.dimension === d).length);
          setEndorseCounts(counts);
        }
      } catch { /* endorsements table may not exist */ }

      // Load career timeline items
      try {
        const timelineData: any[] = [];

        // Portfolio items
        const { data: portfolioItems } = await supabase
          .from("portfolios")
          .select("*")
          .eq("user_id", profileId)
          .in("source", ["self", "nutunion"])
          .order("started_at", { ascending: false, nullsFirst: false });

        if (portfolioItems) {
          timelineData.push(
            ...portfolioItems.map((p: any) => ({
              type: "portfolio",
              date: p.started_at,
              title: p.title,
              description: p.description,
              source: p.source === "nutunion" ? "Verified by NutUnion" : "Self",
              sourceColor: p.source === "nutunion" ? "blue" : "gray",
              icon: Briefcase,
            }))
          );
        }

        // Projects
        const { data: projectMembers } = await supabase
          .from("project_members")
          .select("projects(id, title, status, started_at)")
          .eq("user_id", profileId);

        if (projectMembers) {
          timelineData.push(
            ...projectMembers
              .filter((pm: any) => pm.projects)
              .map((pm: any) => ({
                type: "project",
                date: pm.projects.started_at,
                title: pm.projects.title,
                description: `Project · ${pm.projects.status}`,
                source: "NutUnion",
                sourceColor: "blue",
                icon: Folder,
              }))
          );
        }

        // Meetings organized
        const { data: meetings } = await supabase
          .from("meetings")
          .select("id, title, created_at")
          .eq("organizer_id", profileId);

        if (meetings) {
          timelineData.push(
            ...meetings.map((m: any) => ({
              type: "meeting",
              date: m.created_at,
              title: m.title,
              description: "Meeting organized",
              source: "NutUnion",
              sourceColor: "blue",
              icon: Calendar,
            }))
          );
        }

        // Groups joined
        const { data: groupMembers } = await supabase
          .from("group_members")
          .select("groups(id, name), created_at")
          .eq("user_id", profileId)
          .eq("status", "active");

        if (groupMembers) {
          timelineData.push(
            ...groupMembers
              .filter((gm: any) => gm.groups)
              .map((gm: any) => ({
                type: "group",
                date: gm.created_at,
                title: gm.groups.name,
                description: "Group joined",
                source: "NutUnion",
                sourceColor: "blue",
                icon: Users,
              }))
          );
        }

        // Sort by date (newest first) and limit to 20
        const sorted = timelineData
          .sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 20);

        setTimelineItems(sorted);
      } catch (e) {
        setTimelineItems([]);
      }

      setLoading(false);
    }
    load();
  }, [profileId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("📋 포트폴리오 링크가 클립보드에 복사되었습니다!");
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("ko-KR", { year: "numeric", month: "short" });
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
    <>
      <style jsx global>{`
        @media print {
          nav, footer, button:not(.print-hidden), .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            background: white !important;
          }
          .bg-nu-paper {
            background: white !important;
          }
          .bg-nu-ink {
            background: #1a1a1a !important;
          }
          .page-break {
            page-break-after: always;
          }
          .no-page-break {
            page-break-inside: avoid;
          }
        }
      `}</style>
      <div className="min-h-screen bg-nu-paper">
        {/* Hero Header */}
        <div className="bg-nu-ink text-nu-paper relative overflow-hidden">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-10 left-10 w-40 h-40 bg-nu-pink rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-60 h-60 bg-nu-blue rounded-full blur-3xl" />
          </div>
          <div className="max-w-4xl mx-auto px-8 py-16 relative">
            <div className="flex items-center justify-between gap-2 mb-6">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-nu-pink" />
                <span className="font-mono-nu text-[11px] font-black uppercase tracking-[0.25em] text-nu-pink">
                  Verified_Portfolio · nutunion.co.kr
                </span>
              </div>
              <button
                onClick={handlePrint}
                className="no-print font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border border-nu-paper/30 text-nu-paper hover:bg-nu-paper/10 transition-all flex items-center gap-1"
              >
                <Printer size={12} /> PDF
              </button>
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
                <span key={b} className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 bg-nu-paper/10 border border-nu-paper/10 text-nu-paper">
                  {b}
                </span>
              ))}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-5 gap-3">
              {[
                { icon: Calendar, value: stats.meetings, label: "미팅" },
                { icon: MessageSquare, value: stats.posts, label: "게시글" },
                { icon: Briefcase, value: stats.projects, label: "볼트" },
                { icon: FileText, value: stats.resources, label: "자료" },
                { icon: Users, value: stats.groups, label: "너트" },
              ].map(s => (
                <div key={s.label} className="text-center p-3 bg-nu-paper/5 border border-nu-paper/10">
                  <s.icon size={14} className="mx-auto text-nu-paper/40 mb-1" />
                  <p className="font-head text-lg font-extrabold">{s.value}</p>
                  <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-paper/40">{s.label}</p>
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
              <span className="font-mono-nu text-[12px] bg-nu-pink/10 text-nu-pink px-2 py-1 font-bold uppercase">
                AVG {avgScore}pt
              </span>
            </div>
            <FullRadar scores={scores} endorseCounts={endorseCounts} />
          </div>

          {/* Endorsement */}
          <div className="space-y-4 no-print">
            <EndorsementPanel targetUserId={profileId} />

            {/* Trust Mark */}
            <div className="bg-nu-ink text-nu-paper p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={16} className="text-nu-blue" />
                <span className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-blue">
                  Trust Verification
                </span>
              </div>
              <p className="text-[13px] text-nu-paper/70 leading-relaxed mb-3">
                이 데이터는 넛유니온 생태계 내 <span className="text-nu-paper font-bold">{stats.meetings + stats.posts + stats.projects + stats.resources}건</span>의 실제 활동으로 검증되었습니다.
              </p>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-green-400" />
                <span className="font-mono-nu text-[10px] text-nu-paper/50 uppercase tracking-widest">Verified by nutunion · {new Date().getFullYear()}</span>
              </div>
            </div>

            {/* Share */}
            <button
              onClick={handleCopyLink}
              className="w-full font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-3 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center justify-center gap-2"
            >
              <Share2 size={14} /> 포트폴리오 링크 공유하기
            </button>
          </div>
        </div>

        {/* Portfolio Gallery */}
        {portfolios.length > 0 && (
          <div className="mt-12 no-page-break">
            <h2 className="font-head text-2xl font-bold text-nu-ink mb-6 flex items-center gap-2">
              <ImageIcon size={24} className="text-nu-pink" /> 포트폴리오
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {portfolios.map((item, idx) => (
                <div key={idx} className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Thumbnail */}
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full aspect-video object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-gradient-to-br from-nu-pink/10 to-nu-blue/10 flex items-center justify-center">
                      <ImageIcon size={48} className="text-nu-pink/30" />
                    </div>
                  )}

                  <div className="p-4">
                    {/* Category Badge */}
                    <div className="mb-3">
                      <span className={`inline-block font-mono-nu text-[10px] font-bold uppercase tracking-widest px-2 py-1 border-[1px] ${
                        item.source === "nutunion"
                          ? "border-nu-blue/30 bg-nu-blue/5 text-nu-blue"
                          : "border-nu-ink/20 bg-nu-ink/5 text-nu-ink/60"
                      }`}>
                        {item.source === "nutunion" ? "🔷 Verified by NutUnion" : "⭐ Self-Registered"}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <h3 className="font-head text-sm font-bold text-nu-ink mb-2 line-clamp-2">{item.title}</h3>
                    <p className="text-[12px] text-nu-muted mb-3 line-clamp-2">{item.description || "No description"}</p>

                    {/* Date Range */}
                    <p className="font-mono-nu text-[12px] text-nu-muted mb-3">
                      {formatDate(item.started_at)} {item.ended_at ? `~ ${formatDate(item.ended_at)}` : "~ 진행 중"}
                    </p>

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {item.tags.slice(0, 3).map((tag: string, ti: number) => (
                          <span key={ti} className="font-mono-nu text-[11px] px-2 py-0.5 bg-nu-cream border border-nu-ink/20 text-nu-ink/70 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* External Link */}
                    {item.external_link && (
                      <a
                        href={item.external_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono-nu text-[12px] font-bold text-nu-pink hover:text-nu-ink transition-colors"
                      >
                        View <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Career Timeline */}
        {timelineItems.length > 0 && (
          <div className="mt-12 no-page-break">
            <h2 className="font-head text-2xl font-bold text-nu-ink mb-8 flex items-center gap-2">
              <Calendar size={24} className="text-nu-pink" /> 커리어 타임라인
            </h2>
            <div className="space-y-6">
              {timelineItems.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <div key={idx} className="flex gap-4">
                    {/* Timeline marker */}
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-nu-white border-[2px] border-nu-pink flex items-center justify-center text-nu-ink flex-shrink-0">
                        <IconComponent size={18} />
                      </div>
                      {idx < timelineItems.length - 1 && (
                        <div className="w-[2px] h-12 bg-nu-ink/10 mt-2" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="pb-2 pt-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-muted">
                          {formatDate(item.date)}
                        </span>
                        <span className={`font-mono-nu text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                          item.sourceColor === "blue"
                            ? "bg-nu-blue/10 text-nu-blue"
                            : "bg-nu-ink/5 text-nu-ink/60"
                        }`}>
                          {item.source}
                        </span>
                      </div>
                      <h3 className="font-head text-sm font-bold text-nu-ink">{item.title}</h3>
                      <p className="text-[12px] text-nu-muted">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
