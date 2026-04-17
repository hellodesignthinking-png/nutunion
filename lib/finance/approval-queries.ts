import { createClient } from "@/lib/supabase/server";

export interface FinApproval {
  id: number | string;
  title: string;
  doc_type: string;
  content?: string;
  amount?: number;
  company?: string;
  status: "대기" | "승인" | "반려";
  request_date: string;
  approve_date?: string;
  requester_id?: string;
  requester_name?: string;
  requester_position?: string;
  requester_department?: string;
  approver_id?: string;
  approver_name?: string;
  reject_reason?: string;
  employee_id?: string;
  attachments?: string | null;
  created_at?: string;
}

export async function getApprovals(opts: { status?: string; company?: string } = {}): Promise<FinApproval[]> {
  const supabase = await createClient();
  let query = supabase.from("approvals").select("*").order("created_at", { ascending: false });
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.company && opts.company !== "all") query = query.eq("company", opts.company);
  const { data } = await query;
  return data || [];
}

export async function getApproval(id: string): Promise<FinApproval | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("approvals").select("*").eq("id", id).maybeSingle();
  return data;
}
