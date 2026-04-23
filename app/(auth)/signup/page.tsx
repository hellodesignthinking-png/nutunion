"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SocialAuth } from "@/components/shared/social-auth";
import { toast } from "sonner";
import { Check, AlertCircle, Loader2 } from "lucide-react";

function StatusIcon({ status }: { status: "idle" | "checking" | "available" | "taken" }) {
  if (status === "idle") return null;
  if (status === "checking") return <Loader2 size={14} className="animate-spin text-nu-muted" />;
  if (status === "available") return <Check size={14} className="text-green-600" />;
  return <AlertCircle size={14} className="text-nu-red" />;
}

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [specialty, setSpecialty] = useState("");
  const [step, setStep] = useState<"terms" | "form">("terms");

  // Agreement states
  const [agreeAll, setAgreeAll] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeCommunity, setAgreeCommunity] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);

  // Validation states
  const [nicknameStatus, setNicknameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  function handleAgreeAll(checked: boolean) {
    setAgreeAll(checked);
    setAgreeTerms(checked);
    setAgreePrivacy(checked);
    setAgreeCommunity(checked);
    setAgreeMarketing(checked);
  }

  function updateAgreement(setter: (v: boolean) => void, value: boolean) {
    setter(value);
    // Check if all required are checked
    setTimeout(() => {
      const form = document.querySelectorAll<HTMLInputElement>(".agree-required");
      const allChecked = Array.from(form).every((el) => el.checked);
      setAgreeAll(allChecked && agreeMarketing);
    }, 0);
  }

  const canProceed = agreeTerms && agreePrivacy && agreeCommunity;

  // Check nickname availability
  async function checkNickname(nickname: string) {
    if (!nickname || nickname.length < 2) {
      setNicknameStatus("idle");
      return;
    }
    setNicknameStatus("checking");
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("nickname", nickname)
      .limit(1);

    setNicknameStatus(data && data.length > 0 ? "taken" : "available");
  }

  // Check email availability
  async function checkEmail(email: string) {
    if (!email || !email.includes("@")) {
      setEmailStatus("idle");
      return;
    }
    setEmailStatus("checking");
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .limit(1);

    setEmailStatus(data && data.length > 0 ? "taken" : "available");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (nicknameStatus === "taken") {
      toast.error("이미 사용 중인 닉네임입니다");
      return;
    }
    if (emailStatus === "taken") {
      toast.error("이미 가입된 이메일입니다");
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = (formData.get("name") as string)?.trim();
    const nickname = (formData.get("nickname") as string)?.trim();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const phone = formData.get("phone") as string;

    const supabase = createClient();

    // signUp 직전 닉네임 최종 중복 검사 (race condition 대비)
    const { data: dupNick } = await supabase
      .from("profiles")
      .select("id")
      .eq("nickname", nickname)
      .limit(1);
    if (dupNick && dupNick.length > 0) {
      toast.error("방금 다른 분이 이 닉네임을 가져갔어요. 다른 닉네임을 선택해주세요.");
      setNicknameStatus("taken");
      setLoading(false);
      return;
    }

    const { data: signed, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, nickname, specialty, phone, agree_marketing: agreeMarketing },
      },
    });

    if (error) {
      let msg = error.message;
      if (msg.includes("already registered")) msg = "이미 가입된 이메일입니다";
      if (msg.includes("weak_password")) msg = "비밀번호가 너무 약합니다 (6자 이상)";
      if (msg.includes("invalid")) msg = "유효하지 않은 이메일 형식입니다";
      toast.error(msg);
      setLoading(false);
      return;
    }

    // 트리거로 profiles 자동 생성되지만, 닉네임이 기본값(user_xxx) 으로 박혔을 수 있어
    // 명시적으로 한 번 더 update 시도 (idempotent).
    if (signed?.user) {
      try {
        await supabase
          .from("profiles")
          .update({ name, nickname, specialty: specialty || null, phone: phone || null })
          .eq("id", signed.user.id);
      } catch { /* 트리거가 아직 실행 전이면 RLS/업데이트 실패 가능 — onboarding 가드가 이어받음 */ }
    }

    toast.success("가입이 완료되었습니다!");
    router.push("/dashboard");
    router.refresh();
  }

  // Step 1: Terms agreement
  if (step === "terms") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-nu-paper">
        <div className="w-full max-w-md">
          <div className="bg-nu-white border border-nu-ink/[0.08] p-10">
            <Link href="/" className="no-underline">
              <h1 className="font-head text-2xl font-extrabold text-nu-ink text-center mb-2">
                nutunion
              </h1>
            </Link>
            <p className="text-center text-nu-gray text-sm mb-8">
              회원가입을 위해 아래 약관에 동의해주세요
            </p>

            {/* Agree all */}
            <label className="flex items-center gap-3 p-4 border border-nu-ink/10 mb-4 cursor-pointer hover:bg-nu-cream/30 transition-colors">
              <input
                type="checkbox"
                checked={agreeAll}
                onChange={(e) => handleAgreeAll(e.target.checked)}
                className="w-5 h-5 accent-nu-pink"
              />
              <span className="font-head text-sm font-bold text-nu-ink">전체 동의</span>
            </label>

            <div className="flex flex-col gap-2 mb-8">
              <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-nu-cream/20 transition-colors">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => updateAgreement(setAgreeTerms, e.target.checked)}
                  className="agree-required w-4 h-4 accent-nu-pink"
                />
                <span className="text-sm flex-1">
                  <span className="text-nu-pink font-medium">[필수]</span> 이용약관 동의
                </span>
                <button type="button" className="font-mono-nu text-[11px] text-nu-muted underline">보기</button>
              </label>

              <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-nu-cream/20 transition-colors">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => updateAgreement(setAgreePrivacy, e.target.checked)}
                  className="agree-required w-4 h-4 accent-nu-pink"
                />
                <span className="text-sm flex-1">
                  <span className="text-nu-pink font-medium">[필수]</span> 개인정보 수집 및 이용 동의
                </span>
                <button type="button" className="font-mono-nu text-[11px] text-nu-muted underline">보기</button>
              </label>

              <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-nu-cream/20 transition-colors">
                <input
                  type="checkbox"
                  checked={agreeCommunity}
                  onChange={(e) => updateAgreement(setAgreeCommunity, e.target.checked)}
                  className="agree-required w-4 h-4 accent-nu-pink"
                />
                <span className="text-sm flex-1">
                  <span className="text-nu-pink font-medium">[필수]</span> 커뮤니티 이용 규칙 동의
                </span>
                <button type="button" className="font-mono-nu text-[11px] text-nu-muted underline">보기</button>
              </label>

              <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-nu-cream/20 transition-colors">
                <input
                  type="checkbox"
                  checked={agreeMarketing}
                  onChange={(e) => updateAgreement(setAgreeMarketing, e.target.checked)}
                  className="w-4 h-4 accent-nu-pink"
                />
                <span className="text-sm flex-1">
                  <span className="text-nu-muted font-medium">[선택]</span> 마케팅 정보 수신 동의
                </span>
              </label>
            </div>

            <Button
              onClick={() => setStep("form")}
              disabled={!canProceed}
              className="w-full bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[13px] uppercase tracking-widest py-6 disabled:opacity-40"
            >
              동의하고 계속하기
            </Button>

            <p className="text-center text-sm text-nu-gray mt-6">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="text-nu-pink font-medium no-underline hover:underline">
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Form
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-nu-paper">
      <div className="w-full max-w-md">
        <div className="bg-nu-white border border-nu-ink/[0.08] p-10">
          <Link href="/" className="no-underline">
            <h1 className="font-head text-2xl font-extrabold text-nu-ink text-center mb-2">
              nutunion
            </h1>
          </Link>
          <p className="text-center text-nu-gray text-sm mb-8">
            새로운 Scene의 시작
          </p>

          {/* Social signup */}
          <SocialAuth />

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-nu-ink/10" />
            <span className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted">
              또는 이메일로 가입
            </span>
            <div className="flex-1 h-px bg-nu-ink/10" />
          </div>

          {/* Email signup */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="name" className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
                이름 *
              </Label>
              <Input id="name" name="name" required placeholder="홍길동" className="mt-1.5 border-nu-ink/15 bg-transparent focus:border-nu-pink" />
            </div>

            <div>
              <Label htmlFor="nickname" className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray flex items-center gap-2">
                닉네임 * <StatusIcon status={nicknameStatus} />
                {nicknameStatus === "taken" && <span className="text-nu-red text-[11px] normal-case tracking-normal">이미 사용 중</span>}
                {nicknameStatus === "available" && <span className="text-green-600 text-[11px] normal-case tracking-normal">사용 가능</span>}
              </Label>
              <Input
                id="nickname"
                name="nickname"
                required
                minLength={2}
                maxLength={20}
                placeholder="scene_maker"
                className={`mt-1.5 border-nu-ink/15 bg-transparent ${nicknameStatus === "taken" ? "border-nu-red/50 focus:border-nu-red" : "focus:border-nu-pink"}`}
                onBlur={(e) => checkNickname(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="email" className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray flex items-center gap-2">
                이메일 * <StatusIcon status={emailStatus} />
                {emailStatus === "taken" && <span className="text-nu-red text-[11px] normal-case tracking-normal">이미 가입됨</span>}
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="hello@nutunion.kr"
                className={`mt-1.5 border-nu-ink/15 bg-transparent ${emailStatus === "taken" ? "border-nu-red/50 focus:border-nu-red" : "focus:border-nu-pink"}`}
                onBlur={(e) => checkEmail(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="phone" className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
                전화번호
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="010-0000-0000"
                className="mt-1.5 border-nu-ink/15 bg-transparent focus:border-nu-pink"
              />
            </div>

            <div>
              <Label htmlFor="password" className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
                비밀번호 *
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="6자 이상"
                className="mt-1.5 border-nu-ink/15 bg-transparent focus:border-nu-pink"
              />
            </div>

            <div>
              <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
                전문분야
              </Label>
              <Select value={specialty} onValueChange={(v) => v && setSpecialty(v)}>
                <SelectTrigger className="mt-1.5 border-nu-ink/15 bg-transparent">
                  <SelectValue placeholder="분야를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="space">공간 (Space)</SelectItem>
                  <SelectItem value="culture">문화 (Culture)</SelectItem>
                  <SelectItem value="platform">플랫폼 (Platform)</SelectItem>
                  <SelectItem value="vibe">바이브 (Vibe)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={loading || nicknameStatus === "taken" || emailStatus === "taken"}
              className="w-full bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[13px] uppercase tracking-widest py-6 mt-2 disabled:opacity-40"
            >
              {loading ? "가입 중..." : "가입하기"}
            </Button>
          </form>

          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setStep("terms")}
              className="font-mono-nu text-[12px] text-nu-muted hover:text-nu-ink"
            >
              ← 약관으로 돌아가기
            </button>
            <Link href="/login" className="text-sm text-nu-pink font-medium no-underline hover:underline">
              로그인
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
