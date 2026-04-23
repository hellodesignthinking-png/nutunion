"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Check, AlertCircle, Loader2, Sparkles } from "lucide-react";

interface Props {
  initialName: string;
  email: string;
  provider: string;
}

type Status = "idle" | "checking" | "available" | "taken" | "invalid";

export function NicknameOnboardingForm({ initialName, email, provider }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 닉네임 변경 시 debounce 검사
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (nickname.length === 0) {
      setStatus("idle");
      return;
    }
    if (nickname.length < 2) {
      setStatus("invalid");
      return;
    }
    // 허용 문자: 한글, 영문, 숫자, 언더스코어, 점, 하이픈
    if (!/^[가-힣a-zA-Z0-9_.\-]+$/.test(nickname)) {
      setStatus("invalid");
      return;
    }
    setStatus("checking");
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("nickname", nickname)
        .limit(1);
      setStatus(data && data.length > 0 ? "taken" : "available");
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nickname]);

  async function save() {
    if (status !== "available") {
      toast.error("사용 가능한 닉네임을 입력해주세요");
      return;
    }
    if (!name.trim()) {
      toast.error("이름을 입력해주세요");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("세션이 만료되었습니다");

      // 한 번 더 락인 — insert/update 하기 직전 중복 최종 확인
      const { data: conflict } = await supabase
        .from("profiles")
        .select("id")
        .eq("nickname", nickname)
        .neq("id", user.id)
        .limit(1);
      if (conflict && conflict.length > 0) {
        toast.error("방금 다른 분이 이 닉네임을 가져갔어요. 다른 닉네임을 선택해주세요.");
        setStatus("taken");
        setSaving(false);
        return;
      }

      // profile 이 아직 없으면 insert, 있으면 update
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("profiles")
          .update({ nickname: nickname.trim(), name: name.trim() })
          .eq("id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("profiles").insert({
          id: user.id,
          email,
          name: name.trim(),
          nickname: nickname.trim(),
        });
        if (error) throw error;
      }

      toast.success(`환영해요, ${nickname} 님! 🎉`);
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      if (err?.code === "23505") {
        toast.error("이미 사용 중인 닉네임입니다");
        setStatus("taken");
      } else {
        toast.error(err.message || "저장 실패");
      }
    } finally {
      setSaving(false);
    }
  }

  const providerLabel = provider === "google" ? "Google" : provider === "kakao" ? "Kakao" : "이메일";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-nu-paper">
      <div className="w-full max-w-md">
        <div className="bg-nu-white border border-nu-ink/[0.08] p-8 md:p-10">
          <div className="flex items-center gap-2 justify-center mb-6">
            <Sparkles size={16} className="text-nu-pink" />
            <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink font-bold">
              Welcome
            </span>
          </div>
          <h1 className="font-head text-2xl font-extrabold text-nu-ink text-center mb-2">
            닉네임을 정해주세요
          </h1>
          <p className="text-center text-nu-gray text-sm mb-6">
            너트·볼트에서 표시되는 이름이에요. 나중에 언제든 바꿀 수 있어요.
          </p>

          <div className="text-[11px] font-mono-nu text-nu-muted text-center mb-8">
            <span className="uppercase tracking-widest">{providerLabel}</span> ·{" "}
            <span>{email}</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite font-bold mb-1.5">
                이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full px-3 py-2.5 border-[1.5px] border-nu-ink/15 rounded focus:border-nu-pink outline-none text-[14px]"
              />
            </div>

            <div>
              <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite font-bold flex items-center gap-2 mb-1.5">
                닉네임
                <StatusBadge status={status} />
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                placeholder="scene_maker"
                autoFocus
                minLength={2}
                maxLength={20}
                className={`w-full px-3 py-2.5 border-[1.5px] rounded outline-none text-[15px] font-mono-nu ${
                  status === "taken" || status === "invalid"
                    ? "border-red-400 focus:border-red-500"
                    : status === "available"
                      ? "border-green-400 focus:border-green-500"
                      : "border-nu-ink/15 focus:border-nu-pink"
                }`}
              />
              <p className="text-[11px] text-nu-muted mt-1">
                2~20자, 한글·영문·숫자·<code>_</code>·<code>.</code>·<code>-</code>
              </p>
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving || status !== "available" || !name.trim()}
            className="mt-8 w-full bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[13px] uppercase tracking-widest py-3.5 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> 저장 중
              </>
            ) : (
              <>시작하기 →</>
            )}
          </button>

          <p className="text-center text-[11px] text-nu-muted mt-4">
            이 단계는 처음 한 번만 진행됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "idle") return null;
  if (status === "checking")
    return (
      <span className="normal-case tracking-normal text-nu-muted inline-flex items-center gap-1 font-normal">
        <Loader2 size={11} className="animate-spin" /> 확인 중
      </span>
    );
  if (status === "available")
    return (
      <span className="normal-case tracking-normal text-green-700 inline-flex items-center gap-1 font-normal">
        <Check size={11} /> 사용 가능
      </span>
    );
  if (status === "taken")
    return (
      <span className="normal-case tracking-normal text-nu-pink inline-flex items-center gap-1 font-normal">
        <AlertCircle size={11} /> 이미 사용 중
      </span>
    );
  if (status === "invalid")
    return (
      <span className="normal-case tracking-normal text-nu-pink inline-flex items-center gap-1 font-normal">
        <AlertCircle size={11} /> 2자 이상, 허용 문자만
      </span>
    );
  return null;
}
