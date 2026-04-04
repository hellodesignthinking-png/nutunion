"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("로그인 성공!");
    router.push("/dashboard");
    router.refresh();
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
            다시 만나서 반가워요
          </p>

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
              {loading ? "로그인 중..." : "로그인"}
            </Button>
          </form>

          <p className="text-center text-sm text-nu-gray mt-6">
            계정이 없으신가요?{" "}
            <Link href="/signup" className="text-nu-pink font-medium no-underline hover:underline">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
