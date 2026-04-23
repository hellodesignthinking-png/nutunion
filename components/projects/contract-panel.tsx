"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileText, Loader2, Check, X, Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { CONTRACT_TEMPLATES, type ContractTemplateKey, calcWithholding } from "@/lib/contracts/templates";

interface Contract {
  id: string;
  project_id: string;
  title: string;
  template: string;
  status: string;
  contract_amount: number | null;
  withholding_rate: number | null;
  client_id: string | null;
  contractor_id: string | null;
  client_signed_at: string | null;
  contractor_signed_at: string | null;
  terms_md: string | null;
  created_at: string;
}

function fmt(n: number) { return new Intl.NumberFormat("ko-KR").format(n); }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:                  { label: "초안",       color: "text-nu-graphite bg-nu-ink/5" },
  sent:                   { label: "전송됨",     color: "text-nu-blue bg-nu-blue/10" },
  signed_by_client:       { label: "갑 서명 완료",color: "text-nu-amber bg-nu-amber/10" },
  signed_by_contractor:   { label: "을 서명 완료",color: "text-nu-amber bg-nu-amber/10" },
  signed:                 { label: "체결 완료",   color: "text-green-700 bg-green-100" },
  cancelled:              { label: "취소됨",      color: "text-nu-muted bg-nu-ink/5" },
  expired:                { label: "만료",        color: "text-red-600 bg-red-50" },
};

export function ContractPanel({ projectId, userId, canEdit }: { projectId: string; userId: string; canEdit: boolean }) {
  const [rows, setRows] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("project_contracts")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setRows((data as Contract[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [projectId]);

  async function signAsRole(c: Contract, role: "client" | "contractor") {
    const name = prompt("서명할 이름을 입력하세요", "");
    if (!name) return;
    const res = await fetch(`/api/contracts?id=${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: role === "client" ? "sign_client" : "sign_contractor", signatureName: name }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || "서명 실패");
    toast.success("서명이 기록됐습니다");
    load();
  }

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper">
      <header className="px-4 py-3 border-b-[2px] border-nu-ink bg-gradient-to-r from-nu-amber/10 to-nu-pink/5 flex items-center justify-between">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite">
            <FileText size={11} className="inline mr-1" /> 계약서 · Contracts
          </div>
          <p className="text-[11px] text-nu-graphite mt-0.5">표준 용역 / NDA / 수익분배 · 3.3% 원천징수 자동 계산</p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setAdding(true)}
            className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper inline-flex items-center gap-1">
            <Plus size={11} /> 계약서 작성
          </button>
        )}
      </header>

      {adding && <ContractCreateForm projectId={projectId} onClose={() => setAdding(false)} onCreated={() => { setAdding(false); load(); }} />}

      {loading ? (
        <div className="p-6 flex justify-center"><Loader2 size={18} className="animate-spin text-nu-muted" /></div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center">
          <FileText size={24} className="mx-auto text-nu-muted mb-2" />
          <p className="text-[12px] text-nu-graphite">아직 작성된 계약서가 없습니다</p>
          <p className="text-[10px] text-nu-muted mt-1">유료 볼트나 B2B 발주 시 계약서 작성을 권장합니다</p>
        </div>
      ) : (
        <ul className="list-none m-0 p-0 divide-y divide-nu-ink/10">
          {rows.map((c) => {
            const meta = STATUS_LABEL[c.status] || STATUS_LABEL.draft;
            const tpl = CONTRACT_TEMPLATES[c.template as ContractTemplateKey];
            const wh = c.contract_amount ? calcWithholding(c.contract_amount, c.withholding_rate ?? 0.033) : null;
            const myRole =
              c.client_id === userId ? "client"
              : c.contractor_id === userId ? "contractor"
              : null;
            const canSign =
              (myRole === "client" && !c.client_signed_at) ||
              (myRole === "contractor" && !c.contractor_signed_at);

            return (
              <li key={c.id} className="p-3">
                <div className="flex items-start gap-2 mb-1">
                  <span className={`inline-flex items-center font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="font-bold text-[13px] text-nu-ink flex-1 truncate">{c.title}</span>
                  {tpl && <span className="font-mono-nu text-[9px] text-nu-muted shrink-0">{tpl.label}</span>}
                </div>
                <div className="font-mono-nu text-[10px] text-nu-graphite mb-1.5">
                  {c.contract_amount ? (
                    <>₩{fmt(c.contract_amount)} · 원천징수 ₩{fmt(wh!.withholding)} · 실수령 ₩{fmt(wh!.net)}</>
                  ) : "금액 미정"}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button type="button" onClick={() => setSelected(c)}
                    className="font-mono-nu text-[10px] uppercase px-2 py-1 border border-nu-ink/20 text-nu-graphite hover:bg-nu-ink/5">
                    본문 보기
                  </button>
                  {canSign && (
                    <button type="button" onClick={() => signAsRole(c, myRole!)}
                      className="font-mono-nu text-[10px] uppercase px-2 py-1 border border-green-600 text-green-700 hover:bg-green-600 hover:text-white inline-flex items-center gap-1">
                      <Check size={10} /> {myRole === "client" ? "갑 서명" : "을 서명"}
                    </button>
                  )}
                  <span className="font-mono-nu text-[9px] text-nu-muted ml-auto">
                    갑 {c.client_signed_at ? "✓" : "·"} / 을 {c.contractor_signed_at ? "✓" : "·"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <div className="fixed inset-0 z-[100] bg-nu-ink/60 p-4 overflow-y-auto" onClick={() => setSelected(null)} role="presentation">
          <div role="dialog" aria-modal="true" className="max-w-2xl mx-auto bg-nu-paper border-[2.5px] border-nu-ink shadow-[8px_8px_0_0_rgba(13,13,13,0.4)] my-8"
            onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between px-5 py-3 border-b-[2px] border-nu-ink bg-nu-cream/30">
              <h3 className="font-head text-lg font-extrabold">{selected.title}</h3>
              <button aria-label="닫기" onClick={() => setSelected(null)} className="p-1 hover:bg-nu-ink/5"><X size={18} /></button>
            </header>
            <div className="p-5 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-nu-ink max-h-[70vh] overflow-y-auto">
              {selected.terms_md}
            </div>
            <footer className="flex gap-2 px-5 py-3 border-t-[2px] border-nu-ink/10 bg-nu-cream/20">
              <button onClick={() => { window.print(); }}
                className="font-mono-nu text-[11px] uppercase px-3 py-1.5 border border-nu-ink/20 hover:bg-nu-ink/5 inline-flex items-center gap-1">
                <Download size={11} /> PDF (인쇄)
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}

function ContractCreateForm({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [template, setTemplate] = useState<ContractTemplateKey>("standard_service");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [clientId, setClientId] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("project_members")
      .select("user_id, role, profile:profiles(id,nickname)")
      .eq("project_id", projectId)
      .then(({ data }) => setMembers((data || []).filter((m: any) => m.profile)));
  }, [projectId]);

  async function submit() {
    if (!title.trim()) return toast.error("제목을 입력해주세요");
    setSaving(true);
    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, template, title, amount, startDate, endDate, clientId: clientId || null, contractorId: contractorId || null }),
    });
    setSaving(false);
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || "생성 실패");
    toast.success("계약서 초안이 생성됐습니다");
    onCreated();
  }

  const wh = amount > 0 ? calcWithholding(amount) : null;

  return (
    <div className="px-4 py-3 border-b-[2px] border-nu-ink/10 bg-nu-amber/5 space-y-2">
      <div className="flex items-center gap-2">
        <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted shrink-0">템플릿</label>
        <select value={template} onChange={(e) => setTemplate(e.target.value as ContractTemplateKey)}
          className="flex-1 px-2 py-1 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none">
          {(Object.entries(CONTRACT_TEMPLATES) as [ContractTemplateKey, any][]).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="계약 제목 (예: nutunion 리브랜딩 용역 계약)"
        className="w-full px-2 py-1 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none" />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="font-mono-nu text-[9px] uppercase text-nu-muted block mb-0.5">갑 (발주)</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}
            className="w-full px-2 py-1 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none">
            <option value="">선택</option>
            {members.map((m) => (<option key={m.user_id} value={m.user_id}>{m.profile.nickname}</option>))}
          </select>
        </div>
        <div>
          <label className="font-mono-nu text-[9px] uppercase text-nu-muted block mb-0.5">을 (수주)</label>
          <select value={contractorId} onChange={(e) => setContractorId(e.target.value)}
            className="w-full px-2 py-1 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none">
            <option value="">선택</option>
            {members.map((m) => (<option key={m.user_id} value={m.user_id}>{m.profile.nickname}</option>))}
          </select>
        </div>
        <div>
          <label className="font-mono-nu text-[9px] uppercase text-nu-muted block mb-0.5">금액 (원)</label>
          <input type="number" step={10000} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full px-2 py-1 border-[2px] border-nu-ink/20 text-sm tabular-nums focus:border-nu-pink outline-none" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
          className="px-2 py-1 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
          className="px-2 py-1 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none" />
      </div>
      {wh && (
        <div className="font-mono-nu text-[10px] text-nu-graphite bg-nu-cream/30 p-2 border border-nu-ink/10">
          원천징수 3.3%: <strong className="text-nu-pink">₩{fmt(wh.withholding)}</strong> 공제 → 실수령 <strong>₩{fmt(wh.net)}</strong>
        </div>
      )}
      <div className="flex items-center justify-end gap-1">
        <button onClick={onClose} className="px-3 py-1.5 border border-nu-ink/20 font-mono-nu text-[11px] uppercase hover:bg-nu-ink/5">취소</button>
        <button onClick={submit} disabled={saving} className="px-3 py-1.5 bg-nu-pink text-nu-paper font-mono-nu text-[11px] font-bold uppercase disabled:opacity-50 inline-flex items-center gap-1">
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} 초안 생성
        </button>
      </div>
    </div>
  );
}
