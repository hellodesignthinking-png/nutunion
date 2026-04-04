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
import { toast } from "sonner";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [specialty, setSpecialty] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const nickname = formData.get("nickname") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, nickname, specialty },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("가입이 완료되었습니다! 이메일을 확인해주세요.");
    router.push("/login");
  }

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

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="name" className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
                이름
              </Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="홍길동"
                className="mt-1.5 border-nu-ink/15 bg-transparent focus:border-nu-pink"
              />
            </div>
            <div>
              <Label htmlFor="nickname" className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
                닉네임
              </Label>
              <Input
                id="nickname"
                name="nickname"
                required
                placeholder="scene_maker"
                className="mt-1.5 border-nu-ink/15 bg-transparent focus:border-nu-pink"
              />
            </div>
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
                minLength={6}
                placeholder="6자 이상"
                className="mt-1.5 border-nu-ink/15 bg-transparent focus:border-nu-pink"
              />
            </div>
            <div>
              <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
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
              disabled={loading}
              className="w-full bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest py-6 mt-2"
            >
              {loading ? "가입 중..." : "가입하기"}
            </Button>
          </form>

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
