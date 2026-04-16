"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, FolderOpen } from "lucide-react";
import Link from "next/link";

const CATEGORIES = [
  { value: "general", label: "일반" },
  { value: "development", label: "개발" },
  { value: "design", label: "디자인" },
  { value: "marketing", label: "마케팅" },
  { value: "operations", label: "운영" },
  { value: "research", label: "리서치" },
  { value: "lh", label: "LH 사업" },
];

export default function CreateStaffProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string)?.trim();
    const description = (fd.get("description") as string)?.trim() || null;
    const category = fd.get("category") as string;
    const createDriveFolder = fd.get("createDrive") === "on";

    if (!title) {
      toast.error("프로젝트 제목을 입력해주세요");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("로그인이 필요합니다"); setLoading(false); return; }

    // Create project
    const { data: project, error } = await supabase
      .from("staff_projects")
      .insert({ title, description, category, created_by: user.id })
      .select()
      .single();

    if (error || !project) {
      toast.error("프로젝트 생성에 실패했습니다");
      setLoading(false);
      return;
    }

    // Add creator as lead member
    await supabase.from("staff_project_members").insert({
      project_id: project.id,
      user_id: user.id,
      role: "lead",
    });

    // Log activity
    await supabase.from("staff_activity").insert({
      project_id: project.id,
      user_id: user.id,
      action: "project_created",
      target_type: "project",
      target_id: project.id,
      metadata: { title },
    });

    // Optionally create Drive folder
    if (createDriveFolder) {
      try {
        const res = await fetch("/api/google/drive/folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ staffProjectId: project.id, folderName: `[Staff] ${title}` }),
        });
        if (!res.ok) {
          throw new Error("Drive API failed");
        }
      } catch {
        toast.error("Drive 폴더 생성에 실패했지만 프로젝트는 생성되었습니다");
      }
    }

    toast.success("프로젝트가 생성되었습니다!");
    router.push(`/staff/workspace/${project.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-10">
      <Link href="/staff/workspace" className="font-mono-nu text-[12px] text-nu-muted uppercase tracking-widest no-underline hover:text-nu-ink flex items-center gap-1 mb-6">
        <ArrowLeft size={12} /> 프로젝트 목록
      </Link>
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">새 프로젝트</h1>
      <p className="text-nu-muted text-sm mb-8">내부 업무 프로젝트를 생성합니다</p>

      <div className="bg-white border border-nu-ink/[0.06] p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">프로젝트명</Label>
            <Input name="title" required placeholder="예: ZeroSite 2026 런칭" className="mt-1.5 border-nu-ink/15 bg-transparent" />
          </div>
          <div>
            <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">설명</Label>
            <Textarea name="description" rows={3} placeholder="프로젝트 목표와 범위를 설명해주세요" className="mt-1.5 border-nu-ink/15 bg-transparent resize-none" />
          </div>
          <div>
            <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">카테고리</Label>
            <select name="category" defaultValue="general" className="mt-1.5 w-full px-3 py-2 border border-nu-ink/15 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 py-2">
            <input type="checkbox" name="createDrive" id="createDrive" className="w-4 h-4 accent-indigo-600" />
            <label htmlFor="createDrive" className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray flex items-center gap-1.5 cursor-pointer">
              <FolderOpen size={14} /> Google Drive 폴더 자동 생성
            </label>
          </div>
          <div className="flex gap-3 mt-4">
            <Button type="submit" disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 font-mono-nu text-[13px] uppercase tracking-widest px-8">
              {loading ? "생성 중..." : "프로젝트 생성"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
