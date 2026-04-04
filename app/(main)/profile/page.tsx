"use client";

import { useEffect, useState } from "react";
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
import type { Profile } from "@/lib/types";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", nickname: "", specialty: "" });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setForm({
          name: data.name || "",
          nickname: data.nickname || "",
          specialty: data.specialty || "",
        });
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!profile) return;
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        name: form.name,
        nickname: form.nickname,
        specialty: form.specialty || null,
      })
      .eq("id", profile.id);

    if (error) {
      toast.error(error.message);
    } else {
      setProfile({ ...profile, name: form.name, nickname: form.nickname, specialty: (form.specialty || null) as Profile["specialty"] });
      setEditing(false);
      toast.success("프로필이 업데이트되었습니다");
    }
    setLoading(false);
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-12">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-nu-cream mb-8" />
          <div className="h-64 bg-nu-cream" />
        </div>
      </div>
    );
  }

  const initial = (profile.nickname || "U").charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-8">
        프로필
      </h1>

      <div className="bg-nu-white border border-nu-ink/[0.08] p-8">
        {/* Avatar */}
        <div className="flex items-center gap-5 mb-8">
          <div className="w-16 h-16 rounded-full bg-nu-pink text-white flex items-center justify-center font-head text-2xl font-bold">
            {initial}
          </div>
          <div>
            <p className="font-head text-lg font-bold">{profile.nickname}</p>
            <p className="text-sm text-nu-muted">{profile.email}</p>
          </div>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-5">
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              이름
            </Label>
            {editing ? (
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1.5 border-nu-ink/15 bg-transparent"
              />
            ) : (
              <p className="mt-1.5 text-nu-ink">{profile.name || "-"}</p>
            )}
          </div>
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              닉네임
            </Label>
            {editing ? (
              <Input
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                className="mt-1.5 border-nu-ink/15 bg-transparent"
              />
            ) : (
              <p className="mt-1.5 text-nu-ink">{profile.nickname}</p>
            )}
          </div>
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              이메일
            </Label>
            <p className="mt-1.5 text-nu-muted">{profile.email}</p>
          </div>
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              전문분야
            </Label>
            {editing ? (
              <Select
                value={form.specialty}
                onValueChange={(v) => v && setForm({ ...form, specialty: v })}
              >
                <SelectTrigger className="mt-1.5 border-nu-ink/15 bg-transparent">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="space">공간 (Space)</SelectItem>
                  <SelectItem value="culture">문화 (Culture)</SelectItem>
                  <SelectItem value="platform">플랫폼 (Platform)</SelectItem>
                  <SelectItem value="vibe">바이브 (Vibe)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="mt-1.5 text-nu-ink capitalize">
                {profile.specialty || "-"}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          {editing ? (
            <>
              <Button
                onClick={handleSave}
                disabled={loading}
                className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest"
              >
                {loading ? "저장 중..." : "저장"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditing(false)}
                className="font-mono-nu text-[11px] uppercase tracking-widest"
              >
                취소
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setEditing(true)}
              className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest"
            >
              프로필 수정
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
