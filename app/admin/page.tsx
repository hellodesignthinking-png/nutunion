import { createClient } from "@/lib/supabase/server";
import { Users, Layers, Calendar, FileText } from "lucide-react";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { count: userCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: groupCount } = await supabase
    .from("groups")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: eventCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .gte("start_at", new Date().toISOString());

  const { count: contentCount } = await supabase
    .from("page_content")
    .select("*", { count: "exact", head: true });

  const stats = [
    { label: "총 회원", count: userCount || 0, icon: Users, color: "bg-nu-blue/10 text-nu-blue" },
    { label: "활성 소모임", count: groupCount || 0, icon: Layers, color: "bg-nu-pink/10 text-nu-pink" },
    { label: "예정 일정", count: eventCount || 0, icon: Calendar, color: "bg-nu-yellow/10 text-nu-amber" },
    { label: "콘텐츠 항목", count: contentCount || 0, icon: FileText, color: "bg-nu-ink/5 text-nu-ink" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-8">
        관리자 대시보드
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-nu-white border border-nu-ink/[0.08] p-6"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 flex items-center justify-center ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <div>
                <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
                  {stat.label}
                </p>
                <p className="font-head text-3xl font-extrabold">{stat.count}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
