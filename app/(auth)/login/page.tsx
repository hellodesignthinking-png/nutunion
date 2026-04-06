"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SocialAuth } from "@/components/shared/social-auth";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      let msg = error.message;
      if (msg.includes("Invalid login")) msg = "이메일 또는 비밀번호가 올바르지 않습니다";
      if (msg.includes("Email not confirmed")) msg = "이메일 인증이 필요합니다";
      if (msg.includes("rate limit")) msg = "너무 많은 시도입니다. 잠시 후 다시 시도해주세요";
      toast.error(msg);
      setLoading(false);
      return;
    }

    toast.success("로그인 성공!");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-nu-paper relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute top-[15%] left-[10%] w-[350px] h-[350px] bg-nu-pink/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[280px] h-[280px] bg-nu-blue/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-nu-white border border-nu-ink/[0.08] p-10">
          <Link href="/" className="no-underline">
            <h1 className="font-head text-2xl font-extrabold text-nu-ink text-center mb-2">
              nutunion
            </h1>
          </Link>
          <p className="text-center text-nu-gray text-sm mb-8">
            다시 만나서 반가워요
          </p>

          {/* Social login */}
          <SocialAuth />

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-nu-ink/10" />
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
              또는
            </span>
            <div className="flex-1 h-px bg-nu-ink/10" />
          </div>

          {/* Email login */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <Label htmlFor="email" className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
                이메일
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="hello@nutunion.kr"
                className="mt-1.5 border-nu-ink/15 bg-transparent focus:border-nu-pink"
              />
            </div>
            <div>
              <Label htmlFor="password" className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
                비밀번호
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="mt-1.5 border-nu-ink/15 bg-transparent focus:border-nu-pink"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest py-6 mt-2"
            >
              {loading ? "로그인 중..." : "이메일로 로그인"}
            </Button>
          </form>

          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              onClick={() => toast.info("관리자에게 문의하세요")}
              className="text-sm text-nu-muted hover:text-nu-pink transition-colors cursor-pointer bg-transparent border-none p-0"
            >
              비밀번호를 잊으셨나요?
            </button>
            <p className="text-sm text-nu-gray">
              <Link href="/signup" className="text-nu-pink font-medium no-underline hover:underline">
                회원가입
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
