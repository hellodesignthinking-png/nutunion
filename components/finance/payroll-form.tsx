"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { calculatePayroll } from "@/lib/finance/payroll-calc";
import { fmtKRW } from "@/lib/finance/format";
import type { FinEmployee, FinPayroll } from "@/lib/finance/types";

export function PayrollForm({
  employee,
  yearMonth,
  existing,
}: {
  employee: FinEmployee;
  yearMonth: string;
  existing?: FinPayroll | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    overtime_hours: existing?.overtime_hours?.toString() || "0",
    bonus_pay: existing?.bonus_pay?.toString() || "0",
    annual_leave_pay: existing?.annual_leave_pay?.toString() || "0",
    other_pay: "0",
    memo: existing?.memo || "",
    paid_date: existing?.paid_date || "",
  });
  const [saving, setSaving] = useState(false);

  // 실시간 계산 미리보기
  const preview = useMemo(() => {
    return calculatePayroll({
      annualSalary: Number(employee.annual_salary) || 0,
      hourlyWage: Number(employee.hourly_wage) || 0,
      dailyHours: Number(employee.daily_hours) || 8,
      weeklyDays: Number(employee.weekly_days) || 5,
      workDays: employee.work_days,
      employmentType: employee.employment_type,
      overtimeHours: Number(form.overtime_hours) || 0,
      bonusPay: Number(form.bonus_pay) || 0,
      annualLeavePay: Number(form.annual_leave_pay) || 0,
      otherPay: Number(form.other_pay) || 0,
    });
  }, [employee, form]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/finance/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employee.id,
          year_month: yearMonth,
          overtime_hours: Number(form.overtime_hours) || 0,
          bonus_pay: Number(form.bonus_pay) || 0,
          annual_leave_pay: Number(form.annual_leave_pay) || 0,
          other_pay: Number(form.other_pay) || 0,
          memo: form.memo || undefined,
          paid_date: form.paid_date || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "저장 실패");
      toast.success("급여가 저장되었습니다");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = "w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[14px] outline-none";
  const labelStyle = "font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
      {/* 좌: 입력 */}
      <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5 h-fit">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink mb-4">
          수당 입력
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className={labelStyle}>연장근로 시간 (h)</div>
            <input type="number" step="0.1" value={form.overtime_hours} onChange={(e) => setForm((f) => ({ ...f, overtime_hours: e.target.value }))} className={inputStyle} />
            {preview.overtimePay > 0 && (
              <p className="text-[10px] text-nu-blue mt-1">+ ₩{fmtKRW(preview.overtimePay)} (시급 {fmtKRW(preview.hourlyRate)} × 1.5)</p>
            )}
          </div>
          <div>
            <div className={labelStyle}>상여금</div>
            <input type="number" value={form.bonus_pay} onChange={(e) => setForm((f) => ({ ...f, bonus_pay: e.target.value }))} className={inputStyle} />
          </div>
          <div>
            <div className={labelStyle}>연차수당</div>
            <input type="number" value={form.annual_leave_pay} onChange={(e) => setForm((f) => ({ ...f, annual_leave_pay: e.target.value }))} className={inputStyle} />
          </div>
          <div>
            <div className={labelStyle}>기타 (식대/교통비 등)</div>
            <input type="number" value={form.other_pay} onChange={(e) => setForm((f) => ({ ...f, other_pay: e.target.value }))} className={inputStyle} />
          </div>
          <div>
            <div className={labelStyle}>지급일</div>
            <input type="date" value={form.paid_date} onChange={(e) => setForm((f) => ({ ...f, paid_date: e.target.value }))} className={inputStyle} />
          </div>
          <div>
            <div className={labelStyle}>메모</div>
            <textarea value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} rows={2} className={`${inputStyle} resize-y`} />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-4 py-3 font-mono-nu text-[12px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
          >
            {saving ? "저장 중..." : existing ? "수정 저장" : "급여 저장"}
          </button>
        </div>
      </div>

      {/* 우: 계산 미리보기 */}
      <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5 h-fit">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink mb-4">
          급여 계산 미리보기
        </div>

        <div className="mb-5 text-center py-4 border-b-[2px] border-nu-ink">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">
            실수령액
          </div>
          <div className="text-[32px] font-bold text-green-700">₩{fmtKRW(preview.netPay)}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">지급</div>
            <Row label="기본급" value={preview.basePay} color="text-nu-ink" />
            {preview.overtimePay > 0 && <Row label="연장근로수당" value={preview.overtimePay} color="text-nu-blue" />}
            {preview.bonusPay > 0 && <Row label="상여금" value={preview.bonusPay} color="text-nu-blue" />}
            {preview.annualLeavePay > 0 && <Row label="연차수당" value={preview.annualLeavePay} color="text-nu-blue" />}
            {preview.otherPay > 0 && <Row label="기타" value={preview.otherPay} color="text-nu-blue" />}
            <div className="flex justify-between text-[13px] font-bold pt-2 mt-1 border-t-[2px] border-nu-ink">
              <span>지급 합계</span><span className="text-nu-blue">₩{fmtKRW(preview.totalPay)}</span>
            </div>
          </div>

          <div>
            <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">공제 (4대보험 + 세금)</div>
            <Row label="국민연금 4.5%" value={preview.nationalPension} color="text-red-600" neg />
            <Row label="건강보험 3.545%" value={preview.healthInsurance} color="text-red-600" neg />
            <Row label="장기요양" value={preview.longTermCare} color="text-red-600" neg />
            <Row label="고용보험 0.9%" value={preview.employmentInsurance} color="text-red-600" neg />
            <Row label="소득세" value={preview.incomeTax} color="text-red-600" neg />
            <Row label="지방소득세" value={preview.localIncomeTax} color="text-red-600" neg />
            <div className="flex justify-between text-[13px] font-bold pt-2 mt-1 border-t-[2px] border-nu-ink">
              <span>공제 합계</span><span className="text-red-600">-₩{fmtKRW(preview.totalDeduction)}</span>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-nu-graphite mt-5 p-3 bg-nu-ink/5">
          ⚠️ 소득세는 간이세액표 근사치이며, 실제 신고 시 국세청 간이세액표 또는 세무사 확인 필요.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, color, neg }: { label: string; value: number; color: string; neg?: boolean }) {
  return (
    <div className="flex justify-between text-[12px] py-1">
      <span className="text-nu-graphite">{label}</span>
      <span className={`font-mono-nu ${color}`}>{neg ? "-" : ""}₩{fmtKRW(value)}</span>
    </div>
  );
}
