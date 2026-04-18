"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  projectId: string;
  initialRecruiting: boolean;
  initialRoles: string[];
  initialNote: string | null;
}

export function RecruitingToggle({ projectId, initialRecruiting, initialRoles, initialNote }: Props) {
  const [recruiting, setRecruiting] = useState(initialRecruiting);
  const [roles, setRoles] = useState<string[]>(initialRoles);
  const [note, setNote] = useState(initialNote ?? "");
  const [roleInput, setRoleInput] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const addRole = () => {
    const v = roleInput.trim();
    if (!v || roles.includes(v)) return;
    setRoles([...roles, v]);
    setRoleInput("");
  };

  const removeRole = (r: string) => setRoles(roles.filter((x) => x !== r));

  const save = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/recruiting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiting, needed_roles: roles, recruiting_note: note }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "실패");
      toast.success(recruiting ? "구인 공고 게시됨" : "구인 마감됨");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
      <div className="flex items-center gap-3 mb-3">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={recruiting}
            onChange={(e) => setRecruiting(e.target.checked)}
            className="w-5 h-5 accent-nu-pink"
          />
          <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
            🔎 구인 중
          </span>
        </label>
        {recruiting && (
          <span className="font-mono-nu text-[9px] uppercase tracking-wider bg-nu-pink text-nu-paper px-1.5 py-0.5">
            /talents 에 노출됨
          </span>
        )}
      </div>

      <div className="mb-3">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
          필요한 역할
        </div>
        <div className="flex gap-2 flex-wrap mb-2">
          {roles.map((r) => (
            <span key={r} className="inline-flex items-center gap-1 border-[2px] border-nu-ink px-2 py-0.5 font-mono-nu text-[11px]">
              {r}
              <button onClick={() => removeRole(r)} className="text-red-600 font-bold">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={roleInput}
            onChange={(e) => setRoleInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRole())}
            placeholder="예: 개발자, 디자이너, 마케터"
            className="flex-1 border-[2px] border-nu-ink bg-nu-paper px-2 py-1.5 text-[13px]"
          />
          <button onClick={addRole} className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-3 font-mono-nu text-[10px] uppercase hover:bg-nu-ink hover:text-nu-paper">
            추가
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
          공고 메모 (/talents 에 표시)
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="지원자에게 보여줄 간단 소개 (우대사항 등)"
          className="w-full border-[2px] border-nu-ink bg-nu-paper px-2 py-2 text-[13px]"
        />
      </div>

      <button
        onClick={save}
        disabled={loading}
        className="w-full border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
      >
        {loading ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}
