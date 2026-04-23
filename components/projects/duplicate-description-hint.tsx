import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AlertTriangle } from "lucide-react";

/**
 * Server component — 같은 description 시작부를 가진 다른 볼트가 있으면 호스트에게 경고.
 * "요구사항 정의부터 QA까지..." 같은 템플릿 복붙 방지.
 */
export async function DuplicateDescriptionHint({ projectId, description }: { projectId: string; description: string }) {
  const head = description.trim().slice(0, 60);
  if (head.length < 20) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, title")
    .ilike("description", `${head.replace(/%/g, "\\%")}%`)
    .neq("id", projectId)
    .limit(5);

  const dupes = data ?? [];
  if (dupes.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
      <div className="border-[2px] border-nu-amber bg-nu-amber/10 p-3 flex items-start gap-3">
        <AlertTriangle size={16} className="text-nu-amber shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-amber font-bold mb-0.5">
            설명 복붙 감지
          </div>
          <p className="text-[12px] text-nu-ink leading-relaxed">
            다른 볼트 <strong>{dupes.length}개</strong> ({dupes.slice(0, 3).map((d) => d.title).join(", ")})
            와 설명이 거의 동일해요. 이 볼트만의 첫 문장을 더해 매력을 살려보세요.
          </p>
          <Link
            href={`/projects/${projectId}/settings`}
            className="inline-block mt-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-amber hover:underline no-underline"
          >
            설명 수정 →
          </Link>
        </div>
      </div>
    </div>
  );
}
