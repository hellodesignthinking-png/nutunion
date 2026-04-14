"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, Clock, XCircle } from "lucide-react";
import ApplicationForm from "@/components/projects/application-form";
import type { ProjectApplication, Project } from "@/lib/types";

const statusMap: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: "검토 대기 중", icon: Clock, color: "text-nu-amber" },
  approved: { label: "승인됨", icon: CheckCircle, color: "text-green-600" },
  rejected: { label: "거절됨", icon: XCircle, color: "text-nu-red" },
  withdrawn: { label: "취소됨", icon: XCircle, color: "text-nu-gray" },
};

export default function ProjectApplyPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [existingApplication, setExistingApplication] = useState<ProjectApplication | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      // Fetch project
      const { data: proj, error: projError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projError || !proj) {
        toast.error("볼트를 찾을 수 없습니다");
        router.push("/projects");
        return;
      }

      setProject(proj);

      // Check if user is already a member
      const { data: membership } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (membership) {
        toast.info("이미 이 볼트의 와셔입니다");
        router.push(`/projects/${projectId}`);
        return;
      }

      // Check existing application
      const { data: existing } = await supabase
        .from("project_applications")
        .select("*")
        .eq("project_id", projectId)
        .eq("applicant_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        setExistingApplication(existing);
      }

      setLoading(false);
    }

    load();
  }, [projectId, router]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-20 flex justify-center">
        <Loader2 size={24} className="animate-spin text-nu-muted" />
      </div>
    );
  }

  // Show existing application status
  if (existingApplication && existingApplication.status !== "withdrawn") {
    const status = statusMap[existingApplication.status] ?? statusMap.pending;
    const StatusIcon = status.icon;

    return (
      <div className="max-w-2xl mx-auto px-8 py-12">
        <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
          지원 현황
        </h1>
        <p className="text-nu-gray text-sm mb-8">{project?.title}</p>

        <div className="border border-nu-ink/[0.12] bg-nu-cream/30 p-8 text-center space-y-4">
          <StatusIcon size={48} className={`mx-auto ${status.color}`} />
          <p className="font-head text-xl font-bold text-nu-ink">
            {status.label}
          </p>
          <p className="text-sm text-nu-gray">
            지원일: {new Date(existingApplication.created_at).toLocaleDateString("ko-KR")}
          </p>
          {existingApplication.message && (
            <div className="text-left mt-6 border-t border-nu-ink/[0.08] pt-4">
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
                지원 메시지
              </p>
              <p className="text-sm text-nu-ink whitespace-pre-wrap">
                {existingApplication.message}
              </p>
            </div>
          )}
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="mt-4 font-mono-nu text-[11px] font-bold uppercase tracking-[0.1em] py-3 px-8 border border-nu-ink/[0.12] text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors"
          >
            볼트로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        볼트 지원하기
      </h1>
      <p className="text-nu-gray text-sm mb-8">{project?.title}</p>

      {userId && (
        <ApplicationForm
          projectId={projectId}
          userId={userId}
          onSuccess={() => {
            toast.success("지원이 완료되었습니다!");
            router.push(`/projects/${projectId}`);
          }}
        />
      )}
    </div>
  );
}
