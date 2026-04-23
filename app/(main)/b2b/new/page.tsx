"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Building2, Plus } from "lucide-react";

export default function B2BNewRequestPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  // 조직 생성 폼 (신규 유저)
  const [orgName, setOrgName] = useState("");
  const [orgTier, setOrgTier] = useState<"startup" | "sme" | "enterprise" | "public" | "nonprofit">("sme");
  const [orgBizNum, setOrgBizNum] = useState("");
  const [orgEmail, setOrgEmail] = useState("");

  // 발주 폼
  const [orgId, setOrgId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"space" | "culture" | "platform" | "vibe">("culture");
  const [budgetMin, setBudgetMin] = useState(0);
  const [budgetMax, setBudgetMax] = useState(0);
  const [deadline, setDeadline] = useState("");
  const [visibility, setVisibility] = useState<"public" | "invited">("public");
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login?redirectTo=/b2b/new"); return; }
      setUserId(user.id);
      const { data } = await supabase.from("b2b_organizations").select("id, name, tier, verified").eq("created_by", user.id);
      setOrgs(data || []);
      if (data && data.length > 0) setOrgId(data[0].id);
      setLoadingOrgs(false);
    })();
  }, [router]);

  async function createOrg() {
    if (!orgName.trim() || !userId) return toast.error("조직명을 입력해주세요");
    const supabase = createClient();
    const { data, error } = await supabase.from("b2b_organizations").insert({
      name: orgName.trim(),
      tier: orgTier,
      business_number: orgBizNum.trim() || null,
      contact_email: orgEmail.trim() || null,
      created_by: userId,
    }).select("id, name").single();
    if (error) return toast.error(error.message);
    toast.success("조직이 등록됐습니다");
    setOrgs([...orgs, data]);
    setOrgId(data.id);
    setOrgName(""); setOrgBizNum(""); setOrgEmail("");
  }

  async function submit() {
    if (!orgId) return toast.error("조직을 먼저 등록하거나 선택해주세요");
    if (!title.trim()) return toast.error("발주 제목을 입력해주세요");
    if (!userId) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("b2b_bolt_requests").insert({
      organization_id: orgId,
      title: title.trim(),
      description: description.trim() || null,
      category,
      budget_min: budgetMin || null,
      budget_max: budgetMax || null,
      deadline: deadline || null,
      visibility,
      submitted_by: userId,
      status: "open",
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("발주가 공개됐습니다");
    router.push(`/b2b/${data.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-8 pb-20">
      <Link href="/b2b" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline inline-flex items-center gap-1 mb-6">
        <ArrowLeft size={11} /> B2B 포털
      </Link>

      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-6 flex items-center gap-2">
        <Building2 size={24} className="text-nu-blue" /> 발주 등록
      </h1>

      {/* 조직 선택 or 생성 */}
      {!loadingOrgs && orgs.length === 0 ? (
        <section className="border-[2.5px] border-nu-amber bg-nu-amber/5 p-4 mb-6 space-y-2">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-amber font-bold">1단계 · 조직 등록</div>
          <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="기관/회사명"
            className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <select value={orgTier} onChange={(e) => setOrgTier(e.target.value as any)}
              className="px-3 py-2 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none">
              <option value="startup">스타트업</option>
              <option value="sme">중소기업</option>
              <option value="enterprise">대기업</option>
              <option value="public">공공기관</option>
              <option value="nonprofit">비영리</option>
            </select>
            <input type="text" value={orgBizNum} onChange={(e) => setOrgBizNum(e.target.value)} placeholder="사업자등록번호 (선택)"
              className="px-3 py-2 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none" />
          </div>
          <input type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} placeholder="담당자 이메일"
            className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none" />
          <button onClick={createOrg} className="w-full py-2 bg-nu-amber text-nu-paper font-mono-nu text-[11px] font-bold uppercase tracking-widest hover:bg-nu-amber/90">
            조직 등록하기
          </button>
        </section>
      ) : (
        <section className="border-[2px] border-nu-ink/10 p-3 mb-6">
          <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-1">발주 조직</label>
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)}
            className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none">
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}{o.verified ? " ✓" : ""}</option>
            ))}
          </select>
        </section>
      )}

      {/* 발주 폼 */}
      <section className="border-[2.5px] border-nu-ink bg-nu-paper p-4 space-y-3">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue font-bold">2단계 · 발주 내용</div>

        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="발주 제목 (예: 강남구 로컬 브랜드 리서치)"
          className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none" />

        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="프로젝트 배경 / 목표 / 산출물"
          rows={5}
          className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none resize-none" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="font-mono-nu text-[9px] uppercase text-nu-muted block mb-0.5">카테고리</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none">
              <option value="space">🏢 공간</option>
              <option value="culture">🎨 문화</option>
              <option value="platform">💻 플랫폼</option>
              <option value="vibe">✨ 바이브</option>
            </select>
          </div>
          <div>
            <label className="font-mono-nu text-[9px] uppercase text-nu-muted block mb-0.5">마감일</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="font-mono-nu text-[9px] uppercase text-nu-muted block mb-0.5">최소 예산 (원)</label>
            <input type="number" step={1000000} value={budgetMin || ""} onChange={(e) => setBudgetMin(Number(e.target.value))}
              className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm tabular-nums focus:border-nu-pink outline-none" />
          </div>
          <div>
            <label className="font-mono-nu text-[9px] uppercase text-nu-muted block mb-0.5">최대 예산 (원)</label>
            <input type="number" step={1000000} value={budgetMax || ""} onChange={(e) => setBudgetMax(Number(e.target.value))}
              className="w-full px-3 py-2 border-[2px] border-nu-ink/20 text-sm tabular-nums focus:border-nu-pink outline-none" />
          </div>
        </div>

        <div>
          <label className="font-mono-nu text-[9px] uppercase text-nu-muted block mb-0.5">공개 범위</label>
          <div className="grid grid-cols-2 gap-1">
            {(["public", "invited"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setVisibility(v)}
                className={`p-2 border-[2px] font-mono-nu text-[10px] uppercase transition-colors ${visibility === v ? "border-nu-ink bg-nu-ink text-nu-paper" : "border-nu-ink/15 text-nu-graphite hover:border-nu-ink/40"}`}>
                {v === "public" ? "🌐 공개 (모든 와셔가 지원)" : "🔒 초대 전용"}
              </button>
            ))}
          </div>
        </div>

        <button onClick={submit} disabled={saving || !orgId || !title.trim()}
          className="w-full py-3 bg-nu-blue text-nu-paper font-mono-nu text-[12px] font-bold uppercase tracking-widest hover:bg-nu-blue/90 disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          발주 공개
        </button>
      </section>
    </div>
  );
}
