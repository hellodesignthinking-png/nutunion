"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ModalShell } from "./modal-shell";

interface CompanyOpt {
  id: string;
  name: string;
}

interface EmployeeData {
  id: string | number;
  name: string;
  company: string;
  position?: string;
  department?: string;
  employment_type?: string;
  email?: string;
  phone?: string;
  annual_salary?: number;
  hourly_wage?: number;
  weekly_days?: number;
  daily_hours?: number;
  work_days?: string;
  join_date?: string;
  status?: string;
}

const EMPLOYMENT_TYPES = ["정규직", "계약직", "인턴", "알바"];
const POSITIONS = ["대표이사", "이사", "부장", "차장", "과장", "대리", "사원", "인턴", "프리랜서"];
const DAYS_OF_WEEK = ["월", "화", "수", "목", "금", "토", "일"];

interface Props {
  companies: CompanyOpt[];
  defaultCompany?: string;
  editing?: EmployeeData | null;
  controlledOpen?: boolean;
  onClose?: () => void;
  triggerLabel?: string;
}

export function EmployeeCreateModal({ companies, defaultCompany, editing, controlledOpen, onClose, triggerLabel }: Props) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (controlledOpen !== undefined) {
      if (!v && onClose) onClose();
    } else {
      setInternalOpen(v);
    }
  };

  const isEdit = !!editing;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialForm = () => ({
    name: editing?.name || "",
    company: editing?.company || (defaultCompany && defaultCompany !== "all" ? defaultCompany : (companies[0]?.id || "")),
    position: editing?.position || "사원",
    department: editing?.department || "",
    employment_type: editing?.employment_type || "정규직",
    email: editing?.email || "",
    phone: editing?.phone || "",
    annual_salary: editing?.annual_salary ? String(editing.annual_salary) : "",
    hourly_wage: editing?.hourly_wage ? String(editing.hourly_wage) : "",
    weekly_days: editing?.weekly_days ? String(editing.weekly_days) : "5",
    daily_hours: editing?.daily_hours ? String(editing.daily_hours) : "8",
    work_days: editing?.work_days || "월,화,수,목,금",
    join_date: editing?.join_date || new Date().toISOString().slice(0, 10),
  });

  const [form, setForm] = useState(initialForm);
  useEffect(() => { if (open) setForm(initialForm()); /* eslint-disable-next-line */ }, [open, editing]);

  const isAlba = form.employment_type === "알바";

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("이름을 입력하세요"); return; }
    if (!form.company) { setError("법인을 선택하세요"); return; }
    if (!isAlba && !form.annual_salary) { setError("연봉을 입력하세요"); return; }
    if (isAlba && !form.hourly_wage) { setError("시급을 입력하세요"); return; }

    setError(null);
    setSubmitting(true);
    try {
      const url = isEdit ? `/api/finance/employees/${editing!.id}` : "/api/finance/employees";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "저장 실패");
      toast.success(isEdit ? "직원 정보가 수정되었습니다" : "직원이 등록되었습니다");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !editing) return;
    if (!confirm(`${editing.name}님을 '퇴직' 상태로 변경하시겠습니까? (데이터는 보존됩니다)`)) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/finance/employees/${editing.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "삭제 실패");
      toast.success("퇴직 처리되었습니다");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const parsedWorkDays = form.work_days.split(",").map((d) => d.trim()).filter(Boolean);
  const toggleDay = (day: string) => {
    const cur = parsedWorkDays;
    const next = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day];
    const sorted = DAYS_OF_WEEK.filter((d) => next.includes(d));
    setForm((f) => ({ ...f, work_days: sorted.join(","), weekly_days: String(sorted.length) }));
  };

  return (
    <>
      {controlledOpen === undefined && (
        <button
          onClick={() => setOpen(true)}
          className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink"
        >
          {triggerLabel || "+ 직원 등록"}
        </button>
      )}

      {open && (
        <ModalShell title={isEdit ? "직원 수정" : "직원 등록"} onClose={() => setOpen(false)} locked={submitting} maxWidth="lg">
          <div className="p-5 flex flex-col gap-4">
              <Field label="이름 *">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="홍길동"
                  className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[14px] outline-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="법인 *">
                  <select
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none"
                  >
                    {companies.filter((c) => c.id !== "all").map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="고용형태">
                  <select
                    value={form.employment_type}
                    onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}
                    className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none"
                  >
                    {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="직급">
                  <select
                    value={form.position}
                    onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                    className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none"
                  >
                    {POSITIONS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="부서">
                  <input
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    placeholder="(선택)"
                    className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="이메일">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="name@example.com"
                    className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none"
                  />
                </Field>
                <Field label="연락처">
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="010-0000-0000"
                    className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none"
                  />
                </Field>
              </div>

              <Field label="입사일">
                <input
                  type="date"
                  value={form.join_date}
                  onChange={(e) => setForm((f) => ({ ...f, join_date: e.target.value }))}
                  className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[14px] outline-none"
                />
              </Field>

              {isAlba ? (
                <>
                  <Field label="시급 (원) *">
                    <input
                      type="number"
                      value={form.hourly_wage}
                      onChange={(e) => setForm((f) => ({ ...f, hourly_wage: e.target.value }))}
                      placeholder="2025년 최저시급 10,030원"
                      className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[14px] outline-none"
                    />
                  </Field>
                  <Field label={`근무요일 (주 ${parsedWorkDays.length}일)`}>
                    <div className="flex gap-1">
                      {DAYS_OF_WEEK.map((day) => {
                        const selected = parsedWorkDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            className={`flex-1 py-2 border-[2px] text-[12px] font-bold ${
                              selected
                                ? "border-nu-pink bg-nu-pink/20 text-nu-pink"
                                : "border-nu-ink/30 text-nu-graphite"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label="일 근무시간">
                    <select
                      value={form.daily_hours}
                      onChange={(e) => setForm((f) => ({ ...f, daily_hours: e.target.value }))}
                      className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => <option key={h} value={h}>{h}시간</option>)}
                    </select>
                  </Field>
                </>
              ) : (
                <Field label="연봉 (원) *">
                  <input
                    type="number"
                    value={form.annual_salary}
                    onChange={(e) => setForm((f) => ({ ...f, annual_salary: e.target.value }))}
                    placeholder="예: 35000000"
                    className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[14px] outline-none"
                  />
                  {form.annual_salary && !isNaN(Number(form.annual_salary)) && (
                    <p className="text-[10px] text-nu-graphite mt-1">
                      월 ₩{Math.round(Number(form.annual_salary) / 12).toLocaleString("ko-KR")}
                    </p>
                  )}
                </Field>
              )}

              {error && (
                <div className="border-[2px] border-red-500 bg-red-50 text-red-600 p-2 text-[12px]">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                {isEdit && editing?.status === "재직" && (
                  <button
                    onClick={handleDelete}
                    disabled={submitting}
                    className="border-[2.5px] border-red-500 bg-nu-paper text-red-600 px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-red-500 hover:text-nu-paper disabled:opacity-50"
                  >
                    퇴직
                  </button>
                )}
                <button
                  onClick={() => !submitting && setOpen(false)}
                  className="flex-1 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
                >
                  {submitting ? "저장 중..." : isEdit ? "수정" : "저장"}
                </button>
              </div>

              <p className="text-[10px] text-nu-graphite">
                ℹ️ 주민번호, 주소, 계약서 서명 등 상세 정보는 저장 후 구 시스템에서 추가 입력하세요.
              </p>
            </div>
        </ModalShell>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}
