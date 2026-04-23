"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Lock, Unlock, Plus, Loader2, AlertCircle, CheckCircle2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

interface EscrowRow {
  id: string;
  project_id: string;
  milestone_id: string | null;
  amount: number;
  currency: string;
  status: "pending" | "held" | "released" | "refunded" | "cancelled" | "disputed";
  fee_amount: number;
  fee_rate: number | null;
  provider: "toss" | "portone" | "manual" | "other" | null;
  provider_txn_id: string | null;
  held_at: string | null;
  released_at: string | null;
  note: string | null;
  created_at: string;
}

const STATUS_META: Record<EscrowRow["status"], { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:   { label: "대기",   color: "text-nu-graphite", bg: "bg-nu-ink/5",     icon: <AlertCircle size={11} /> },
  held:      { label: "홀드",   color: "text-nu-blue",     bg: "bg-nu-blue/10",   icon: <Lock size={11} /> },
  released:  { label: "지급",   color: "text-green-700",   bg: "bg-green-100",    icon: <CheckCircle2 size={11} /> },
  refunded:  { label: "환불",   color: "text-orange-600",  bg: "bg-orange-100",   icon: <RotateCcw size={11} /> },
  cancelled: { label: "취소",   color: "text-nu-muted",    bg: "bg-nu-ink/5",     icon: <X size={11} /> },
  disputed:  { label: "분쟁",   color: "text-red-700",     bg: "bg-red-100",      icon: <AlertCircle size={11} /> },
};

function fmt(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n);
}

export function ProjectEscrowPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const [rows, setRows] = useState<EscrowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ amount: 0, feeRate: 0.05, note: "", provider: "manual" as EscrowRow["provider"] });

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("project_escrow")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setRows((data as EscrowRow[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [projectId]);

  async function createEscrow() {
    if (!form.amount || form.amount < 1000) {
      toast.error("금액을 1,000원 이상 입력해주세요");
      return;
    }
    const supabase = createClient();
    const feeAmount = Math.round(form.amount * form.feeRate);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("project_escrow").insert({
      project_id: projectId,
      amount: form.amount,
      currency: "KRW",
      status: "pending",
      fee_amount: feeAmount,
      fee_rate: form.feeRate,
      provider: form.provider,
      note: form.note || null,
      created_by: user?.id,
    });
    if (error) toast.error("생성 실패: " + error.message);
    else {
      toast.success("에스크로 레코드가 생성되었습니다");
      setAdding(false);
      setForm({ amount: 0, feeRate: 0.05, note: "", provider: "manual" });
      load();
    }
  }

  async function updateStatus(id: string, status: EscrowRow["status"]) {
    const supabase = createClient();
    const patch: any = { status };
    if (status === "held") patch.held_at = new Date().toISOString();
    if (status === "released") patch.released_at = new Date().toISOString();
    const { error } = await supabase.from("project_escrow").update(patch).eq("id", id);
    if (error) toast.error("상태 변경 실패: " + error.message);
    else { toast.success("업데이트됨"); load(); }
  }

  const totalHeld = rows.filter((r) => r.status === "held").reduce((s, r) => s + r.amount, 0);
  const totalReleased = rows.filter((r) => r.status === "released").reduce((s, r) => s + r.amount, 0);
  const totalPending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0);

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper">
      <header className="px-4 py-3 border-b-[2px] border-nu-ink bg-gradient-to-r from-nu-blue/5 to-nu-pink/5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite">
              <Lock size={11} className="inline mr-1" /> Escrow · 에스크로 원장
            </div>
            <p className="text-[11px] text-nu-graphite mt-0.5">
              결제·정산 보호 기록. 현재는 수동 원장 — 토스페이/포트원 연동은 단계적 도입 예정
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setAdding(!adding)}
              className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper inline-flex items-center gap-1"
            >
              <Plus size={11} /> 기록 추가
            </button>
          )}
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="p-2 bg-nu-cream/30 border border-nu-ink/10">
            <div className="font-mono-nu text-[9px] uppercase text-nu-graphite">대기</div>
            <div className="font-head text-[16px] font-extrabold text-nu-graphite tabular-nums">₩{fmt(totalPending)}</div>
          </div>
          <div className="p-2 bg-nu-blue/5 border border-nu-blue/20">
            <div className="font-mono-nu text-[9px] uppercase text-nu-blue">홀드 중</div>
            <div className="font-head text-[16px] font-extrabold text-nu-blue tabular-nums">₩{fmt(totalHeld)}</div>
          </div>
          <div className="p-2 bg-green-50 border border-green-200">
            <div className="font-mono-nu text-[9px] uppercase text-green-700">지급 완료</div>
            <div className="font-head text-[16px] font-extrabold text-green-700 tabular-nums">₩{fmt(totalReleased)}</div>
          </div>
        </div>
      </header>

      {/* Add form */}
      {adding && (
        <div className="px-4 py-3 border-b-[2px] border-nu-ink/10 bg-nu-pink/5 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-0.5">금액 (원)</label>
              <input
                type="number"
                min={1000}
                step={1000}
                value={form.amount || ""}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                placeholder="예: 1000000"
                className="w-full px-2 py-1 border-[2px] border-nu-ink/20 text-sm tabular-nums focus:border-nu-pink outline-none"
              />
            </div>
            <div>
              <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-0.5">수수료율 (%)</label>
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={form.feeRate * 100}
                onChange={(e) => setForm({ ...form, feeRate: (Number(e.target.value) || 0) / 100 })}
                className="w-full px-2 py-1 border-[2px] border-nu-ink/20 text-sm tabular-nums focus:border-nu-pink outline-none"
              />
            </div>
          </div>
          <div>
            <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-0.5">결제 수단</label>
            <select
              value={form.provider || "manual"}
              onChange={(e) => setForm({ ...form, provider: e.target.value as EscrowRow["provider"] })}
              className="w-full px-2 py-1 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none"
            >
              <option value="manual">수동 (현금/계좌이체)</option>
              <option value="toss">토스페이먼츠 (준비중)</option>
              <option value="portone">포트원 (준비중)</option>
              <option value="other">기타</option>
            </select>
          </div>
          <textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="용도 / 메모 (예: M1 마일스톤 지급)"
            rows={2}
            className="w-full px-2 py-1 border-[2px] border-nu-ink/20 text-sm focus:border-nu-pink outline-none resize-none"
          />
          <div className="flex items-center justify-between text-[11px] text-nu-graphite font-mono-nu">
            <span>수수료: <strong className="text-nu-pink">₩{fmt(Math.round(form.amount * form.feeRate))}</strong> · 순지급: <strong>₩{fmt(form.amount - Math.round(form.amount * form.feeRate))}</strong></span>
            <div className="flex gap-1">
              <button type="button" onClick={() => setAdding(false)} className="px-2 py-1 border border-nu-ink/20 hover:bg-nu-ink/5">취소</button>
              <button type="button" onClick={createEscrow} className="px-3 py-1 bg-nu-pink text-nu-paper font-bold">기록 생성</button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="p-6 flex justify-center"><Loader2 size={20} className="animate-spin text-nu-muted" /></div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center">
          <Lock size={24} className="mx-auto text-nu-muted mb-2" />
          <p className="text-[12px] text-nu-graphite">아직 에스크로 기록이 없습니다</p>
          <p className="text-[10px] text-nu-muted mt-1">유료 볼트는 홀드 → 마일스톤 확인 → 지급 순으로 안전하게 관리됩니다</p>
        </div>
      ) : (
        <ul className="list-none m-0 p-0 divide-y divide-nu-ink/10">
          {rows.map((r) => {
            const meta = STATUS_META[r.status];
            const net = r.amount - r.fee_amount;
            return (
              <li key={r.id} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 font-mono-nu text-[9px] uppercase tracking-widest ${meta.bg} ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className="font-head text-[14px] font-extrabold text-nu-ink tabular-nums">₩{fmt(r.amount)}</span>
                  <span className="font-mono-nu text-[10px] text-nu-graphite">
                    수수료 ₩{fmt(r.fee_amount)} · 순지급 ₩{fmt(net)}
                  </span>
                  {r.provider && <span className="font-mono-nu text-[9px] uppercase text-nu-muted ml-auto">{r.provider}</span>}
                </div>
                {r.note && <p className="text-[11px] text-nu-graphite">{r.note}</p>}
                <div className="font-mono-nu text-[9px] text-nu-muted mt-1">
                  {new Date(r.created_at).toLocaleString("ko", { month: "short", day: "numeric" })}
                  {r.held_at && ` · 홀드 ${new Date(r.held_at).toLocaleDateString("ko")}`}
                  {r.released_at && ` · 지급 ${new Date(r.released_at).toLocaleDateString("ko")}`}
                </div>
                {canEdit && r.status !== "released" && r.status !== "refunded" && r.status !== "cancelled" && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {r.status === "pending" && (
                      <button onClick={() => updateStatus(r.id, "held")} className="font-mono-nu text-[10px] uppercase px-2 py-1 border border-nu-blue text-nu-blue hover:bg-nu-blue hover:text-nu-paper">
                        홀드 전환
                      </button>
                    )}
                    {r.status === "held" && (
                      <button onClick={() => updateStatus(r.id, "released")} className="font-mono-nu text-[10px] uppercase px-2 py-1 border border-green-600 text-green-700 hover:bg-green-600 hover:text-white">
                        지급 완료
                      </button>
                    )}
                    <button onClick={() => updateStatus(r.id, "refunded")} className="font-mono-nu text-[10px] uppercase px-2 py-1 border border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white">
                      환불
                    </button>
                    <button onClick={() => updateStatus(r.id, "cancelled")} className="font-mono-nu text-[10px] uppercase px-2 py-1 border border-nu-ink/20 text-nu-graphite hover:bg-nu-ink/5">
                      취소
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
