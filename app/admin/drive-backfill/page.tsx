import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import { DriveBackfillClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Drive Backfill — Admin · nutunion" };

export default async function DriveBackfillPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  // 현황 — 아직 폴더 없는 너트/볼트 수
  const [{ count: groupsPending }, { count: projectsPending }] = await Promise.all([
    supabase
      .from("groups")
      .select("id", { count: "exact", head: true })
      .is("google_drive_folder_id", null)
      .eq("is_active", true),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .is("google_drive_folder_id", null),
  ]);

  const sharedDriveConfigured = !!(
    process.env.GOOGLE_SHARED_DRIVE_ID ||
    process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_PARENT_ID
  );

  return (
    <div className="reader-shell min-h-screen">
      <div className="max-w-[820px] mx-auto px-4 md:px-6 py-8 space-y-6">
        <Link
          href="/admin/overview"
          className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-ink no-underline"
        >
          <ArrowLeft size={11} /> Admin
        </Link>

        <header>
          <p className="reader-meta">Admin · Google Drive</p>
          <h1 className="reader-h1 mt-0.5">너트/볼트 Drive 일괄 생성</h1>
          <p className="reader-meta mt-1">
            아직 공유 폴더가 없는 너트/볼트에 대해 자동으로 Google Drive 폴더 + 서브폴더를 생성하고 DB 와 연결합니다.
          </p>
        </header>

        {/* [Drive migration Phase A] Deprecation banner */}
        <section className="border-2 border-amber-500 bg-amber-50 p-4 text-[13px] text-amber-900 space-y-1">
          <p className="font-bold">⚠️ 이 도구는 더 이상 사용하지 않습니다.</p>
          <p>
            신규 너트/볼트 자료는 Cloudflare R2 에 저장됩니다. 과거 Drive 자료는{" "}
            <Link href="/admin/storage/migrate-from-drive" className="underline font-bold">
              /admin/storage/migrate-from-drive
            </Link>{" "}
            에서 이전하세요. (legacy 정리용으로 실행하려면 API 에 <code className="bg-white px-1 rounded">?force=1</code> 쿼리 필요)
          </p>
        </section>

        {/* 환경 체크 */}
        <section className="border border-nu-ink/10 rounded-lg p-4 bg-nu-cream/20 text-[13px] space-y-2">
          <h2 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">환경</h2>
          <div className="flex items-center justify-between">
            <span>GOOGLE_SHARED_DRIVE_ID</span>
            <span className={sharedDriveConfigured ? "text-green-700 font-bold" : "text-amber-700 font-bold"}>
              {sharedDriveConfigured ? "✓ 설정됨" : "⚠ 미설정"}
            </span>
          </div>
          {!sharedDriveConfigured && (
            <p className="text-[12px] text-amber-800 bg-amber-50 p-2 rounded">
              Shared Drive 가 설정되지 않으면 관리자 개인 Drive 에 생성됩니다 → 호스트/멤버가 접근할 수 없을 수 있어요.
              <code className="ml-1 bg-white px-1.5 py-0.5 rounded text-[10px]">GOOGLE_SHARED_DRIVE_ID</code> 환경변수 추가를 권장합니다.
            </p>
          )}
        </section>

        {/* 현황 */}
        <section className="grid grid-cols-2 gap-3">
          <div className="border border-nu-ink/10 rounded-lg p-4 bg-white">
            <div className="text-[11px] font-mono-nu text-nu-muted uppercase tracking-widest">폴더 없는 너트</div>
            <div className="text-[28px] font-bold tabular-nums text-nu-ink">{groupsPending ?? 0}</div>
          </div>
          <div className="border border-nu-ink/10 rounded-lg p-4 bg-white">
            <div className="text-[11px] font-mono-nu text-nu-muted uppercase tracking-widest">폴더 없는 볼트</div>
            <div className="text-[28px] font-bold tabular-nums text-nu-ink">{projectsPending ?? 0}</div>
          </div>
        </section>

        {/* 클라이언트 (fetch 실행 + 결과 표시) */}
        <DriveBackfillClient initialPending={(groupsPending ?? 0) + (projectsPending ?? 0)} />

        <section className="border-t border-nu-ink/10 pt-4 text-[12px] text-nu-graphite space-y-1.5">
          <p className="font-bold">⚙ 사전 체크리스트</p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>내 Google 계정이 OAuth 연결되어 있어야 합니다 (Profile → Integrations)</li>
            <li>Shared Drive 를 쓰려면 Admin 이 해당 드라이브의 Content Manager 이상 권한 필요</li>
            <li>처리가 오래 걸릴 수 있어요 (건당 약 1초 + 서브폴더 3~4개)</li>
            <li>이미 폴더가 있는 너트/볼트는 건너뜁니다</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
