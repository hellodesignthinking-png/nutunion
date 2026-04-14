"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { XCircle } from "lucide-react";
import { useState } from "react";

interface CancelApplicationButtonProps {
  projectId: string;
  userId: string;
}

export function CancelApplicationButton({ projectId, userId }: CancelApplicationButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!confirm("지원을 취소하시겠습니까?")) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("project_applications")
      .delete()
      .eq("project_id", projectId)
      .eq("applicant_id", userId);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    toast.success("지원이 취소되었습니다");
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-2.5 border border-nu-muted text-nu-muted hover:border-nu-red hover:text-nu-red transition-colors flex items-center gap-1 disabled:opacity-50"
    >
      <XCircle size={12} /> 취소
    </button>
  );
}
