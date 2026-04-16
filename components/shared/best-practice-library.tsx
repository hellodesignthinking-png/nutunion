"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  FileCheck,
  Layout,
  Search,
  Eye,
  ArrowUpRight,
  Loader2,
  Plus,
  Crown,
} from "lucide-react";
import { toast } from "sonner";

interface BestPracticeLibraryProps {
  groupId?: string;
}

interface BestPractice {
  id: string;
  title: string;
  description: string;
  content: Record<string, any>;
  target_type: "curriculum" | "guideline" | "template";
  tags: string[];
  view_count: number;
  created_at: string;
  promoted_by: string;
  source_type: string;
  profiles?: {
    nickname: string;
    avatar_url?: string;
  };
}

interface GroupMember {
  role: "host" | "member" | "guest";
}

type FilterTab = "전체" | "curriculum" | "guideline" | "template";
type SortBy = "latest" | "views";

const TARGET_TYPES: Record<
  "curriculum" | "guideline" | "template",
  { label: string; icon: React.ReactNode; color: string }
> = {
  curriculum: {
    label: "공식 커리큘럼",
    icon: <BookOpen size={14} />,
    color: "bg-nu-blue/10 text-nu-blue",
  },
  guideline: {
    label: "프로젝트 가이드라인",
    icon: <FileCheck size={14} />,
    color: "bg-nu-pink/10 text-nu-pink",
  },
  template: {
    label: "템플릿",
    icon: <Layout size={14} />,
    color: "bg-nu-amber/10 text-nu-amber",
  },
};

const TAG_COLORS = [
  "bg-nu-pink/10 text-nu-pink",
  "bg-nu-blue/10 text-nu-blue",
  "bg-nu-amber/10 text-nu-amber",
  "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700",
  "bg-cyan-100 text-cyan-700",
];

export function BestPracticeLibrary({ groupId }: BestPracticeLibraryProps) {
  const [practices, setPractices] = useState<BestPractice[]>([]);
  const [filteredPractices, setFilteredPractices] = useState<BestPractice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("전체");
  const [sortBy, setSortBy] = useState<SortBy>("latest");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isHostOrAdmin, setIsHostOrAdmin] = useState(false);
  const [incrementing, setIncrementing] = useState<Set<string>>(new Set());

  // Initialize user
  useEffect(() => {
    async function initUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);

        // Check if user is host/admin of the group
        if (groupId) {
          const { data: member } = await supabase
            .from("group_members")
            .select("role")
            .eq("group_id", groupId)
            .eq("user_id", user.id)
            .single();

          if (member && (member.role === "host" || member.role === "admin")) {
            setIsHostOrAdmin(true);
          }
        } else {
          // If no groupId, check user profile role
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

          if (profile && (profile.role === "host" || profile.role === "admin")) {
            setIsHostOrAdmin(true);
          }
        }
      }
    }
    initUser();
  }, [groupId]);

  // Load best practices
  const loadPractices = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      let query = supabase
        .from("best_practices")
        .select(
          `
          id,
          title,
          description,
          content,
          target_type,
          tags,
          view_count,
          created_at,
          promoted_by,
          source_type,
          profiles!promoted_by(nickname, avatar_url)
        `
        )
        .eq("is_published", true);

      if (groupId) {
        query = query.eq("group_id", groupId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading best practices:", error);
        toast.error("베스트 프랙티스를 불러올 수 없습니다");
        return;
      }

      // Normalize profiles from Supabase FK join (may be array)
      const normalized = (data || []).map((d: any) => ({
        ...d,
        profiles: Array.isArray(d.profiles) ? d.profiles[0] : d.profiles,
      }));
      setPractices(normalized);
    } catch (err) {
      console.error("Error:", err);
      toast.error("오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadPractices();
  }, [loadPractices]);

  // Filter and sort practices
  useEffect(() => {
    let result = [...practices];

    // Filter by tab
    if (filterTab !== "전체") {
      const targetTypeKey = {
        curriculum: "curriculum",
        guideline: "guideline",
        template: "template",
      }[filterTab];

      result = result.filter(
        (p) => p.target_type === targetTypeKey
      );
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    if (sortBy === "latest") {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else {
      result.sort((a, b) => b.view_count - a.view_count);
    }

    setFilteredPractices(result);
  }, [practices, searchQuery, filterTab, sortBy]);

  const handleViewContent = async (id: string) => {
    setExpandedId(expandedId === id ? null : id);

    // Increment view count
    if (expandedId !== id && !incrementing.has(id)) {
      setIncrementing((prev) => new Set([...prev, id]));
      try {
        const supabase = createClient();
        await supabase.rpc("increment_best_practice_views", {
          bp_id: id,
        });
      } catch (err) {
        console.error("Error incrementing view count:", err);
      } finally {
        setIncrementing((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  };

  const getTagColor = (index: number) => TAG_COLORS[index % TAG_COLORS.length];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) return "방금 전";
    if (diffInHours < 24) return `${diffInHours}시간 전`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}일 전`;
    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}개월 전`;
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="font-head text-2xl font-bold text-nu-ink mb-1">
            베스트 프랙티스 라이브러리
          </h1>
          <p className="text-sm text-nu-muted">
            팀 내에서 가장 효과적인 방법들을 찾아보세요
          </p>
        </div>

        {/* Search and Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-nu-muted"
            />
            <input
              type="text"
              placeholder="제목, 설명, 태그로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-nu-cream/30 border-2 border-nu-ink/10 text-sm focus:outline-none focus:border-nu-pink transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2 bg-nu-cream/30 border-2 border-nu-ink/10 text-[12px] font-mono-nu font-bold focus:outline-none focus:border-nu-pink"
            >
              <option value="latest">최신순</option>
              <option value="views">조회수순</option>
            </select>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {["전체", "curriculum", "guideline", "template"].map((tab) => {
            const displayTab =
              tab === "curriculum"
                ? "curriculum"
                : tab === "guideline"
                  ? "guideline"
                  : tab === "template"
                    ? "template"
                    : "전체";
            const isActive = filterTab === displayTab;

            return (
              <button
                key={tab}
                onClick={() => setFilterTab(displayTab as FilterTab)}
                className={`px-3 py-1.5 font-mono-nu text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-nu-pink text-white"
                    : "bg-nu-ink/5 text-nu-ink hover:bg-nu-ink/10"
                }`}
              >
                {tab === "전체"
                  ? "전체"
                  : TARGET_TYPES[tab as keyof typeof TARGET_TYPES].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-nu-muted" />
        </div>
      ) : filteredPractices.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-3 text-4xl">📭</div>
          <p className="font-head text-sm font-bold text-nu-ink mb-1">
            아직 등록된 베스트 프랙티스가 없습니다
          </p>
          <p className="text-[12px] text-nu-muted">
            첫 번째 베스트 프랙티스를 등록해보세요
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredPractices.map((practice, idx) => (
            <div
              key={practice.id}
              className="bg-nu-white border-2 border-nu-ink/[0.08] overflow-hidden hover:border-nu-ink/15 transition-colors"
            >
              {/* Card Header - Always Visible */}
              <button
                onClick={() => handleViewContent(practice.id)}
                className="w-full px-4 py-3 text-left hover:bg-nu-cream/10 transition-colors focus:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`p-1 ${TARGET_TYPES[practice.target_type].color}`}
                      >
                        {TARGET_TYPES[practice.target_type].icon}
                      </div>
                      <h3 className="font-head text-sm font-bold text-nu-ink line-clamp-1">
                        {practice.title}
                      </h3>
                    </div>
                    <p className="text-[12px] text-nu-muted line-clamp-1">
                      {practice.description}
                    </p>
                  </div>
                  <ArrowUpRight
                    size={16}
                    className={`text-nu-muted shrink-0 transition-transform ${
                      expandedId === practice.id ? "rotate-180" : ""
                    }`}
                  />
                </div>

                {/* Tags and Meta */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {practice.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {practice.tags.slice(0, 3).map((tag, tidx) => (
                        <span
                          key={tidx}
                          className={`px-1.5 py-0.5 text-[11px] font-mono-nu font-bold ${getTagColor(tidx)}`}
                        >
                          {tag}
                        </span>
                      ))}
                      {practice.tags.length > 3 && (
                        <span className="px-1.5 py-0.5 text-[11px] font-mono-nu font-bold text-nu-muted">
                          +{practice.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-2 flex items-center justify-between text-[12px] text-nu-muted">
                  <div className="flex items-center gap-2">
                    <Eye size={12} />
                    <span>{practice.view_count}</span>
                  </div>
                  <span>{formatDate(practice.created_at)}</span>
                </div>
              </button>

              {/* Expanded Content */}
              {expandedId === practice.id && (
                <div className="px-4 py-3 border-t border-nu-ink/5 bg-nu-cream/10 space-y-3 animate-in slide-in-from-top-2 duration-200">
                  {/* Promoted By */}
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-nu-blue/20 flex items-center justify-center text-[12px] font-bold text-nu-blue shrink-0">
                      {practice.profiles?.avatar_url ? (
                        <img
                          src={practice.profiles.avatar_url}
                          alt={practice.profiles.nickname}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        practice.profiles?.nickname?.charAt(0).toUpperCase() || "U"
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-mono-nu font-bold text-nu-ink">
                        {practice.profiles?.nickname || "Unknown"}
                      </p>
                      <p className="text-[11px] text-nu-muted">
                        {practice.source_type === "meeting"
                          ? "미팅에서 승격"
                          : practice.source_type === "resource"
                            ? "리소스에서 승격"
                            : "세션에서 승격"}
                      </p>
                    </div>
                  </div>

                  {/* Full Content */}
                  {practice.content?.sourceContent && (
                    <div className="space-y-1">
                      <p className="font-mono-nu text-[11px] font-black uppercase tracking-widest text-nu-ink">
                        콘텐츠
                      </p>
                      <div className="px-3 py-2 bg-nu-white border border-nu-ink/5 text-[12px] text-nu-ink whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                        {practice.content.sourceContent}
                      </div>
                    </div>
                  )}

                  {/* All Tags */}
                  {practice.tags.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-mono-nu text-[11px] font-black uppercase tracking-widest text-nu-ink">
                        모든 태그
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {practice.tags.map((tag, tidx) => (
                          <span
                            key={tidx}
                            className={`px-2 py-0.5 text-[11px] font-mono-nu font-bold ${getTagColor(tidx)}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Promote Button - Visible to hosts/admins */}
      {isHostOrAdmin && (
        <div className="flex justify-center pt-4">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-nu-pink text-white font-mono-nu text-[12px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">
            <Plus size={12} />
            승격하기
          </button>
        </div>
      )}
    </div>
  );
}
