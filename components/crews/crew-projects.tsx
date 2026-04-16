"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Calendar, Loader2 } from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-nu-gray text-white",
  active: "bg-green-600 text-white",
  completed: "bg-nu-blue text-white",
  archived: "bg-nu-muted text-white",
};

interface CrewProject {
  id: string;
  title: string;
  status: string;
  category: string | null;
  start_date: string | null;
  end_date: string | null;
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "";
  const s = new Date(start).toLocaleDateString("ko", {
    month: "short",
    day: "numeric",
  });
  if (!end) return s + " ~";
  const e = new Date(end).toLocaleDateString("ko", {
    month: "short",
    day: "numeric",
  });
  return `${s} — ${e}`;
}


const catBg: Record<string, string> = {
  space: "bg-nu-blue",
  culture: "bg-nu-amber",
  platform: "bg-nu-ink",
  vibe: "bg-nu-pink",
};

export function CrewProjects({ groupId }: { groupId: string }) {
  const [projects, setProjects] = useState<CrewProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Fetch project_members where crew_id matches, then join projects
      const { data: memberships } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("crew_id", groupId);

      if (!memberships || memberships.length === 0) {
        setLoading(false);
        return;
      }

      const projectIds = memberships.map((m) => m.project_id);

      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, title, status, category, start_date, end_date")
        .in("id", projectIds)
        .neq("status", "draft")
        .order("created_at", { ascending: false });

      setProjects(projectsData || []);
      setLoading(false);
    }
    load();
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-nu-muted" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
        <p className="text-nu-gray text-sm">연결된 프로젝트가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/projects/${p.id}`}
          className="block bg-nu-white border border-nu-ink/[0.08] p-4 no-underline hover:border-nu-pink/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {p.category && (
                  <span
                    className={`font-mono-nu text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 text-white ${catBg[p.category] || "bg-nu-gray"}`}
                  >
                    {p.category}
                  </span>
                )}
                <span
                  className={`font-mono-nu text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 ${statusColors[p.status] || "bg-nu-gray text-white"}`}
                >
                  {p.status}
                </span>
              </div>
              <h4 className="font-head text-sm font-extrabold text-nu-ink truncate">
                {p.title}
              </h4>
              <div className="flex items-center gap-3 mt-1 text-xs text-nu-muted">
                {(p.start_date || p.end_date) && (
                  <span className="flex items-center gap-1 font-mono-nu text-[12px]">
                    <Calendar size={10} />
                    {formatDateRange(p.start_date, p.end_date)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
