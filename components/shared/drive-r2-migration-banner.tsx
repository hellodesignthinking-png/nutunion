import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/**
 * DriveR2MigrationBanner — admin/host 에게만 보이는 1줄 경고 배너.
 *
 * 조건:
 *  - 해당 너트/볼트에 google_drive_folder_id 가 있음
 *  - file_attachments 중 storage_type != 'r2' 인 행이 1개 이상 존재
 *
 * 위 조건을 모두 만족할 때만 노란 배너를 렌더.
 * admin 이 아니고 host 도 아니면 숨김.
 */

interface Props {
  scope: "group" | "project";
  id: string;
  driveFolderId?: string | null;
  hostId?: string | null;
}

export async function DriveR2MigrationBanner({ scope, id, driveFolderId, hostId }: Props) {
  if (!driveFolderId) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // admin 권한 확인 (host 는 hostId prop 으로 비교)
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = me?.role === "admin";
  const isHost = hostId === user.id;
  if (!isAdmin && !isHost) return null;

  // 해당 스코프의 file_attachments 중 r2 가 아닌 것 1개라도 있는지 확인
  try {
    const scopeCol = scope === "group" ? "group_id" : "project_id";
    const { count } = await supabase
      .from("file_attachments")
      .select("id", { count: "exact", head: true })
      .eq(scopeCol, id)
      .neq("storage_type", "r2");
    if (!count || count === 0) return null;

    return (
      <div className="flex items-center gap-2 px-3 py-2 mb-3 border-2 border-amber-500 bg-amber-50 text-[12px]">
        <AlertTriangle size={14} className="text-amber-700 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-bold text-amber-900">과거 Drive 파일이 아직 이전되지 않았습니다</span>
          <span className="text-amber-800/80 ml-1 hidden sm:inline">
            ({count}개) · R2 로 옮겨야 외부 노출/권한 문제가 사라져요
          </span>
        </div>
        <Link
          href="/admin/storage/migrate-from-drive"
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white rounded text-[11px] font-semibold no-underline hover:bg-amber-700"
        >
          이전 도구 열기
        </Link>
      </div>
    );
  } catch {
    return null;
  }
}
