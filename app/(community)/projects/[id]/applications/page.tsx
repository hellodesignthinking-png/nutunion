"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import ApplicationList from "@/components/projects/application-list";
import type { Project } from "@/lib/types";

export default function ProjectApplicationsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isLead, setIsLead] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [project, setProject] = useState<Project | null>(null);

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

      // Check if user is project lead or admin
      const { data: membership } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const hasAccess =
        !profileError && (membership?.role === "lead" || profile?.role === "admin");

      if (!hasAccess) {
        toast.error("지원서를 관리할 권한이 없습니다");
        router.push(`/projects/${projectId}`);
        return;
      }

      setIsLead(true);
      setLoading(false);
    }

    load();
  }, [projectId, router]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-20 flex justify-center">
        <Loader2 size={24} className="animate-spin text-nu-muted" />
      </div>
    );
  }

  if (!isLead) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-20 text-center">
        <ShieldAlert size={48} className="mx-auto text-nu-muted mb-4" />
        <p className="text-nu-gray">접근 권한이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        지원서 관리
      </h1>
      <p className="text-nu-gray text-sm mb-8">{project?.title}</p>

      <ApplicationList
        projectId={projectId}
        isLead={isLead}
        userId={userId}
      />
    </div>
  );
}
