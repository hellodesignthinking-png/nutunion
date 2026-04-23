"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Building2, Sparkles, Loader2, Users, Calendar, Target, CheckCircle2 } from "lucide-react";

function fmt(n: number | null | undefined) { return n ? new Intl.NumberFormat("ko-KR").format(n) : "—"; }

export default function B2BRequestDetailPage() {
  const params = useParams();
  const requestId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [canRun, setCanRun] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => { load(); }, [requestId]);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const { data: r } = await supabase
      .from("b2b_bolt_requests")
      .select("id, title, description, category, budget_min, budget_max, deadline, status, submitted_by, created_at, organization:b2b_organizations(id, name, tier, verified, created_by)")
      .eq("id", requestId)
      .maybeSingle();
    setRequest(r);

    const org = Array.isArray(r?.organization) ? r?.organization[0] : r?.organization;
    if (user) {
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setCanRun(r?.submitted_by === user.id || org?.created_by === user.id || p?.role === "admin");
    }

    const mRes = await fetch(`/api/b2b/${requestId}/match`);
    const mData = await mRes.json();
    setMatches(mData.matches || []);

    setLoading(false);
  }

  async function runMatch() {
    setRunning(true);
    const res = await fetch(`/api/b2b/${requestId}/match`, { method: "POST" });
    const data = await res.json();
    setRunning(false);
    if (!res.ok) return toast.error(data.error || "매칭 실패");
    toast.success(`${data.saved}개 추천 (${data.method}) 생성됨`);
    load();
  }

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-12"><Loader2 className="animate-spin mx-auto text-nu-muted" size={24} /></div>;
  if (!request) return <div className="max-w-4xl mx-auto px-6 py-12 text-center text-nu-graphite">발주를 찾을 수 없습니다</div>;

  const org = Array.isArray(request.organization) ? request.organization[0] : request.organization;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 pb-20">
      <Link href="/b2b" className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline mb-4">
        <ArrowLeft size={11} /> B2B 포털
      </Link>

      <header className="border-b-[2px] border-nu-ink/10 pb-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Building2 size={12} className="text-nu-blue" />
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue font-bold">
            {org?.tier || "—"}
          </span>
          {org?.verified && <CheckCircle2 size={11} className="text-green-600" />}
          <span className="font-mono-nu text-[11px] text-nu-graphite">{org?.name}</span>
          <span className={`font-mono-nu text-[10px] uppercase tracking-widest ml-auto ${
            request.status === "open" ? "text-nu-pink" :
            request.status === "matching" ? "text-nu-amber" :
            request.status === "matched" ? "text-green-700" : "text-nu-muted"
          }`}>
            {request.status}
          </span>
        </div>
        <h1 className="font-head text-2xl font-extrabold text-nu-ink">{request.title}</h1>
        <div className="flex items-center gap-3 mt-2 font-mono-nu text-[11px] text-nu-graphite">
          <span><Target size={10} className="inline mr-0.5" /> {request.category}</span>
          <span>💰 ₩{fmt(request.budget_min)} ~ ₩{fmt(request.budget_max)}</span>
          {request.deadline && <span><Calendar size={10} className="inline mr-0.5" /> ~{new Date(request.deadline).toLocaleDateString("ko")}</span>}
        </div>
      </header>

      {request.description && (
        <section className="mb-6 border-[2px] border-nu-ink/10 p-4 whitespace-pre-wrap text-[13px] text-nu-ink leading-relaxed">
          {request.description}
        </section>
      )}

      {/* AI 매칭 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-pink font-bold flex items-center gap-1">
            <Sparkles size={12} /> AI 추천 너트 3개
          </h2>
          {canRun && (
            <button onClick={runMatch} disabled={running}
              className="inline-flex items-center gap-1 font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 disabled:opacity-50">
              {running ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {matches.length > 0 ? "다시 매칭" : "매칭 실행"}
            </button>
          )}
        </div>

        {matches.length === 0 ? (
          <div className="border-[2px] border-dashed border-nu-ink/15 p-8 text-center">
            <Sparkles size={24} className="mx-auto text-nu-muted mb-2" />
            <p className="text-[13px] text-nu-graphite">아직 AI 추천이 실행되지 않았습니다</p>
            {canRun && (
              <p className="text-[11px] text-nu-muted mt-1">
                상단 <strong>매칭 실행</strong> 버튼을 눌러 발주 내용 분석 → 어울릴 너트 3개를 찾아보세요
              </p>
            )}
          </div>
        ) : (
          <ul className="list-none m-0 p-0 space-y-2">
            {matches.map((m) => {
              const g = Array.isArray(m.group) ? m.group[0] : m.group;
              if (!g) return null;
              const pct = Math.round((m.match_score ?? 0) * 100);
              return (
                <li key={m.id}>
                  <div className="border-[2px] border-nu-ink/10 hover:border-nu-pink bg-nu-paper p-3 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-nu-pink/10 border border-nu-pink/30 flex items-center justify-center font-head text-sm font-bold text-nu-pink shrink-0">
                        #{m.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/groups/${g.id}`} className="font-bold text-[14px] text-nu-ink hover:text-nu-pink no-underline truncate">
                            {g.name}
                          </Link>
                          <span className="font-mono-nu text-[9px] uppercase text-nu-graphite">{g.category}</span>
                        </div>
                        {g.description && <p className="text-[11px] text-nu-graphite line-clamp-2 leading-relaxed">{g.description}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="h-1.5 w-32 bg-nu-ink/5 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-nu-pink to-nu-amber" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono-nu text-[10px] font-bold text-nu-pink tabular-nums">{pct}%</span>
                          <span className="font-mono-nu text-[10px] text-nu-graphite">· {m.reason}</span>
                          <span className="font-mono-nu text-[9px] text-nu-muted uppercase ml-auto">{m.method}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
