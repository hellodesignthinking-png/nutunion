"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function CreateGroupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("");
  const [permitted, setPermitted] = useState<boolean | null>(null);

  // Permission check on mount — DB에서 직접 최신값 조회
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPermitted(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("can_create_crew, role, grade")
        .eq("id", user.id)
        .single();

      const canCreate =
        profile?.role === "admin" ||
        profile?.can_create_crew === true ||
        profile?.grade === "silver" ||
        profile?.grade === "gold" ||
        profile?.grade === "vip";

      setPermitted(canCreate ? true : false);
    })();
  }, []);

  if (permitted === null) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-12 text-center">
        <p className="text-nu-gray">권한을 확인하는 중...</p>
      </div>
    );
  }

  if (permitted === false) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-12 text-center">
        <h1 className="font-head text-2xl font-extrabold text-nu-ink mb-4">
          소모임 개설 권한이 없습니다
        </h1>
        <p className="text-nu-gray mb-2">
          소모임을 개설하려면 <strong>실버 등급 이상</strong>이 필요합니다.
        </p>
        <p className="text-nu-muted text-sm mb-6">
          현재 등급이 부족하다면 관리자에게 등급 상향을 요청하세요.
        </p>
        <Link
          href="/groups"
          className="font-mono-nu text-[11px] uppercase tracking-widest bg-nu-ink text-nu-paper px-6 py-3 no-underline hover:bg-nu-pink transition-colors inline-block"
        >
          소모임 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const maxMembers = parseInt(formData.get("maxMembers") as string) || 20;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("로그인이 필요합니다");
      setLoading(false);
      return;
    }

    const { data: group, error } = await supabase
      .from("groups")
      .insert({
        name,
        category,
        description,
        host_id: user.id,
        max_members: maxMembers,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Add creator as host member
    const { error: memberError } = await supabase.from("group_members").insert({
      group_id: group.id,
      user_id: user.id,
      role: "host",
      status: "active",
    });

    if (memberError) {
      toast.error("소모임은 생성되었으나 호스트 등록에 실패했습니다. 다시 시도해주세요.");
      setLoading(false);
      return;
    }

    toast.success("소모임이 생성되었습니다!");
    router.push(`/groups/${group.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        새 소모임 만들기
      </h1>
      <p className="text-nu-gray text-sm mb-8">
        새로운 Scene을 시작하세요
      </p>

      <div className="bg-nu-white border border-nu-ink/[0.08] p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              소모임 이름
            </Label>
            <Input
              name="name"
              required
              placeholder="Space Architects Seoul"
              className="mt-1.5 border-nu-ink/15 bg-transparent"
            />
          </div>

          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              카테고리
            </Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v)} required>
              <SelectTrigger className="mt-1.5 border-nu-ink/15 bg-transparent">
                <SelectValue placeholder="카테고리 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="space">공간 (Space)</SelectItem>
                <SelectItem value="culture">문화 (Culture)</SelectItem>
                <SelectItem value="platform">플랫폼 (Platform)</SelectItem>
                <SelectItem value="vibe">바이브 (Vibe)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              소개
            </Label>
            <Textarea
              name="description"
              rows={4}
              placeholder="소모임에 대해 소개해주세요"
              className="mt-1.5 border-nu-ink/15 bg-transparent resize-none"
            />
          </div>

          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              최대 인원
            </Label>
            <Input
              name="maxMembers"
              type="number"
              defaultValue={20}
              min={2}
              max={200}
              className="mt-1.5 border-nu-ink/15 bg-transparent w-32"
            />
          </div>

          <div className="flex gap-3 mt-4">
            <Button
              type="submit"
              disabled={loading}
              className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest px-8"
            >
              {loading ? "생성 중..." : "소모임 만들기"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="font-mono-nu text-[11px] uppercase tracking-widest"
            >
              취소
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
