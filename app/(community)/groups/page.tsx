import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "소모임 — nutunion",
  description: "nutunion 소모임을 탐색하고 참여하세요",
};

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  let debugInfo = "start";
  
  try {
    debugInfo = "createClient";
    const supabase = await createClient();
    
    debugInfo = "getUser";
    const { data: { user } } = await supabase.auth.getUser();
    
    debugInfo = "query groups";
    const { data: groups, error: groupsError } = await supabase
      .from("groups")
      .select("id, name, category, description")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (groupsError) {
      return (
        <div className="min-h-screen bg-nu-paper flex items-center justify-center px-8 pt-20">
          <div className="max-w-lg bg-white border-2 border-red-200 p-8">
            <h2 className="text-xl font-bold text-red-600 mb-2">DB 쿼리 오류</h2>
            <pre className="text-xs text-red-500 bg-red-50 p-4 overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify(groupsError, null, 2)}
            </pre>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-nu-paper pt-20 px-8">
        <h1 className="text-3xl font-bold mb-4">소모임 (진단모드)</h1>
        <p className="text-sm text-gray-500 mb-8">
          User: {user?.id || "비로그인"} | Groups: {groups?.length || 0}개
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(groups || []).map((g: any) => (
            <a key={g.id} href={`/groups/${g.id}`} className="block p-6 bg-white border-2 border-gray-200 hover:border-pink-400 transition-colors no-underline">
              <span className="text-xs uppercase tracking-widest text-pink-500 font-mono">{g.category}</span>
              <h3 className="text-lg font-bold mt-1 text-gray-900">{g.name}</h3>
              <p className="text-sm text-gray-500 mt-2 line-clamp-2">{g.description}</p>
            </a>
          ))}
        </div>
      </div>
    );
  } catch (err: any) {
    return (
      <div className="min-h-screen bg-nu-paper flex items-center justify-center px-8 pt-20">
        <div className="max-w-lg bg-white border-2 border-red-200 p-8">
          <h2 className="text-xl font-bold text-red-600 mb-2">서버 에러 (stage: {debugInfo})</h2>
          <pre className="text-xs text-red-500 bg-red-50 p-4 overflow-auto whitespace-pre-wrap break-all">
            {err?.message || "Unknown"}{"\n"}{err?.stack || "no stack"}
          </pre>
        </div>
      </div>
    );
  }
}
