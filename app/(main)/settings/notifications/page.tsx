"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Bell, Mail, MessageSquare, Smartphone } from "lucide-react";

interface Prefs {
  inapp: Record<string, boolean>;
  email: Record<string, boolean>;
  kakao: Record<string, boolean>;
  push: Record<string, boolean>;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

const EVENTS = [
  { key: "bolt_applicant",    label: "볼트 지원자 도착",      critical: true },
  { key: "milestone_due",     label: "마일스톤 마감 D-3",    critical: true },
  { key: "nut_invitation",    label: "너트 초대",              critical: true },
  { key: "review_request",    label: "동료 리뷰 요청",        critical: false },
  { key: "weekly_match",      label: "주간 TOP 3 추천",       critical: false },
  { key: "new_post",          label: "너트 새 게시물",         critical: false },
  { key: "stiffness_tierup",  label: "강성 티어 상승",         critical: false },
  { key: "system",            label: "시스템 공지",             critical: true },
];

const CHANNELS = [
  { key: "inapp",  label: "인앱",     icon: Bell },
  { key: "email",  label: "이메일",   icon: Mail },
  { key: "kakao",  label: "알림톡",   icon: MessageSquare },
  { key: "push",   label: "Push",    icon: Smartphone },
] as const;

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const { data } = await supabase.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle();
    setPrefs(
      (data as Prefs) ?? {
        inapp: Object.fromEntries(EVENTS.map((e) => [e.key, true])),
        email: Object.fromEntries(EVENTS.map((e) => [e.key, e.critical])),
        kakao: Object.fromEntries(EVENTS.map((e) => [e.key, e.critical])),
        push:  Object.fromEntries(EVENTS.map((e) => [e.key, e.critical])),
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
      }
    );
    setLoading(false);
  }

  function toggle(channel: "inapp" | "email" | "kakao" | "push", event: string) {
    if (!prefs) return;
    setPrefs({
      ...prefs,
      [channel]: { ...prefs[channel], [event]: !prefs[channel]?.[event] },
    });
  }

  async function save() {
    if (!prefs || !userId) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("notification_preferences").upsert({
      user_id: userId,
      inapp: prefs.inapp,
      email: prefs.email,
      kakao: prefs.kakao,
      push: prefs.push,
      quiet_hours_start: prefs.quiet_hours_start,
      quiet_hours_end: prefs.quiet_hours_end,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("저장됐어요");
  }

  if (loading) return <div className="max-w-3xl mx-auto px-6 py-12"><Loader2 className="animate-spin mx-auto text-[color:var(--neutral-500)]" size={20} /></div>;
  if (!prefs) return <div className="max-w-3xl mx-auto px-6 py-12 text-center">로그인이 필요해요</div>;

  return (
    <div className="reader-shell">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 pb-20">
        <Link href="/notifications" className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-[color:var(--neutral-500)] hover:text-[color:var(--neutral-900)] no-underline mb-4">
          <ArrowLeft size={11} /> 알림으로
        </Link>

        <header className="mb-8 pb-6 border-b border-[color:var(--neutral-100)]">
          <p className="reader-meta mb-1">Settings</p>
          <h1 className="reader-h1">알림 환경설정</h1>
          <p className="reader-body mt-2 max-w-[580px]">
            이벤트별 · 채널별로 받을 알림을 선택하세요. 조용한 시간대에는 긴급 알림만 전송됩니다.
          </p>
        </header>

        {/* Matrix */}
        <section className="mb-8">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-[2px] border-[color:var(--neutral-100)]">
                  <th className="text-left font-mono-nu text-[10px] uppercase tracking-[0.25em] text-[color:var(--neutral-500)] pb-3 pr-4">이벤트</th>
                  {CHANNELS.map((c) => {
                    const Icon = c.icon;
                    return (
                      <th key={c.key} className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-[color:var(--neutral-500)] pb-3 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Icon size={13} />
                          <span>{c.label}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {EVENTS.map((e) => (
                  <tr key={e.key} className="border-b border-[color:var(--neutral-100)]">
                    <td className="py-3 pr-4 text-[14px] text-[color:var(--neutral-900)]">
                      {e.label}
                      {e.critical && <span className="ml-1.5 font-mono-nu text-[9px] text-[color:var(--liquid-primary)]">critical</span>}
                    </td>
                    {CHANNELS.map((c) => (
                      <td key={c.key} className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(c.key, e.key)}
                          aria-pressed={!!prefs[c.key]?.[e.key]}
                          className={`w-8 h-8 rounded-[var(--ds-radius-md)] border-[1.5px] inline-flex items-center justify-center transition-colors ${
                            prefs[c.key]?.[e.key]
                              ? "border-[color:var(--neutral-900)] bg-[color:var(--neutral-900)] text-white"
                              : "border-[color:var(--neutral-200)] text-[color:var(--neutral-300)] hover:border-[color:var(--neutral-500)]"
                          }`}
                        >
                          {prefs[c.key]?.[e.key] && <Check size={12} />}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Quiet hours */}
        <section className="mb-8 pb-6 border-b border-[color:var(--neutral-100)]">
          <h2 className="reader-h2 mb-3">조용한 시간대</h2>
          <p className="reader-meta mb-3">이 시간 동안 critical 이외 알림은 08:00 이후에 묶어 전송됩니다.</p>
          <div className="flex items-center gap-3">
            <input type="time" value={prefs.quiet_hours_start ?? "22:00"} onChange={(e) => setPrefs({ ...prefs, quiet_hours_start: e.target.value })}
              className="px-3 py-2 border-[2px] border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] focus:border-[color:var(--liquid-primary)] outline-none" />
            <span className="text-[color:var(--neutral-500)]">~</span>
            <input type="time" value={prefs.quiet_hours_end ?? "08:00"} onChange={(e) => setPrefs({ ...prefs, quiet_hours_end: e.target.value })}
              className="px-3 py-2 border-[2px] border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] focus:border-[color:var(--liquid-primary)] outline-none" />
          </div>
        </section>

        <div className="flex items-center justify-end gap-2">
          <Link href="/notifications" className="px-4 py-2 border border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] text-[13px] text-[color:var(--neutral-700)] hover:bg-[color:var(--neutral-50)] no-underline">취소</Link>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 bg-[color:var(--neutral-900)] text-white rounded-[var(--ds-radius-md)] text-[13px] font-medium hover:bg-[color:var(--liquid-primary)] transition-colors inline-flex items-center gap-1 disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
