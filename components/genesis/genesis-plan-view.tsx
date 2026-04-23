"use client";

import { useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Phase {
  name: string;
  goal: string;
  duration_days?: number | null;
  wiki_pages?: Array<{ title: string; outline: string }>;
  milestones?: string[];
}

interface Plan {
  title: string;
  summary: string;
  category: string;
  phases: Phase[];
  suggested_roles: Array<{ role_name: string; specialty_tags: string[]; why: string }>;
  resources_folders: string[];
  first_tasks: string[];
}

interface Props {
  kind: "group" | "project";
  targetId: string;
  intent: string;
  plan: Plan;
  modelUsed: string | null;
  createdAt: string;
  summary?: {
    wikis_created?: number;
    tasks_created?: number;
    milestones_created?: number;
    members_invited?: number;
    folders_scaffolded?: number;
  } | null;
}

export function GenesisPlanView({ kind, targetId, intent, plan, modelUsed, createdAt, summary }: Props) {
  const [cloning, setCloning] = useState(false);
  const router = useRouter();

  async function handleClone() {
    setCloning(true);
    try {
      // Re-run plan + provision with same intent
      const planRes = await fetch("/api/genesis/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, kind }),
      });
      if (!planRes.ok) throw new Error("plan 실패");
      const { plan: newPlan, model_used } = await planRes.json();

      const provRes = await fetch("/api/genesis/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, plan: newPlan, intent, model_used }),
      });
      if (!provRes.ok) throw new Error("provision 실패");
      const data = await provRes.json();

      toast.success("✨ 복제 생성 완료!");
      router.push(kind === "group" ? `/groups/${data.target_id}` : `/projects/${data.target_id}`);
    } catch (e: any) {
      toast.error("복제 실패: " + (e?.message || "unknown"));
    } finally {
      setCloning(false);
    }
  }

  const backHref = kind === "group" ? `/groups/${targetId}` : `/projects/${targetId}`;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="border-[3px] border-nu-ink bg-nu-paper shadow-[4px_4px_0_0_#0D0F14] p-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-nu-ink text-nu-paper">
            <Sparkles size={10} /> Genesis AI
          </span>
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
            {kind === "group" ? "너트(Group)" : "볼트(Project)"}
          </span>
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
            생성 {new Date(createdAt).toLocaleDateString("ko-KR")}
          </span>
          {modelUsed && (
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
              model · {modelUsed}
            </span>
          )}
        </div>
        <h1 className="font-head text-3xl font-extrabold text-nu-ink tracking-tight uppercase mb-3 m-0">
          {plan.title}
        </h1>
        <p className="text-nu-graphite leading-relaxed mb-4">{plan.summary}</p>

        <div className="bg-nu-paper border-[2px] border-nu-ink/10 p-4 mb-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">
            Original Intent
          </div>
          <p className="text-sm text-nu-ink m-0">{intent}</p>
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            {[
              { label: "위키", value: summary.wikis_created || 0 },
              { label: "Task", value: summary.tasks_created || 0 },
              { label: "Milestone", value: summary.milestones_created || 0 },
              { label: "초대", value: summary.members_invited || 0 },
              { label: "R2 폴더", value: summary.folders_scaffolded || 0 },
            ].map((s) => (
              <div key={s.label} className="border-[2px] border-nu-ink/10 p-2 text-center">
                <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">{s.label}</div>
                <div className="font-head text-xl font-extrabold text-nu-ink">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <a
            href={backHref}
            className="font-mono-nu text-[11px] uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink bg-nu-paper text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper"
          >
            ← {kind === "group" ? "너트" : "볼트"} 보기
          </a>
          <button
            onClick={handleClone}
            disabled={cloning}
            className="font-mono-nu text-[11px] uppercase tracking-widest px-4 py-2 bg-nu-pink text-nu-paper hover:bg-nu-ink disabled:opacity-50 flex items-center gap-1.5 border-none cursor-pointer"
          >
            {cloning ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            복제해서 새로 만들기
          </button>
        </div>
      </div>

      {/* Phase timeline */}
      <section className="border-[3px] border-nu-ink bg-nu-paper p-6">
        <h2 className="font-head text-xl font-extrabold text-nu-ink tracking-tight uppercase mb-4 m-0">
          Phase Timeline
        </h2>
        <div className="space-y-3">
          {plan.phases.map((p, i) => (
            <div key={i} className="border-l-[4px] border-nu-ink pl-4 py-2">
              <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                <h3 className="font-head text-lg font-extrabold text-nu-ink m-0">{p.name}</h3>
                {p.duration_days && (
                  <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
                    {p.duration_days}일
                  </span>
                )}
              </div>
              <p className="text-sm text-nu-graphite mb-2">{p.goal}</p>
              {p.wiki_pages && p.wiki_pages.length > 0 && (
                <div className="mb-2">
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">
                    Wiki Pages
                  </div>
                  <ul className="text-xs text-nu-ink pl-4 m-0">
                    {p.wiki_pages.map((w, j) => (
                      <li key={j}>{w.title}</li>
                    ))}
                  </ul>
                </div>
              )}
              {p.milestones && p.milestones.length > 0 && (
                <div>
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">
                    Milestones
                  </div>
                  <ul className="text-xs text-nu-ink pl-4 m-0">
                    {p.milestones.map((m, j) => (
                      <li key={j}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Suggested roles */}
      {plan.suggested_roles && plan.suggested_roles.length > 0 && (
        <section className="border-[3px] border-nu-ink bg-nu-paper p-6">
          <h2 className="font-head text-xl font-extrabold text-nu-ink tracking-tight uppercase mb-4 m-0">
            Suggested Roles
          </h2>
          <div className="space-y-2">
            {plan.suggested_roles.map((r, i) => (
              <div key={i} className="border-[2px] border-nu-ink/10 p-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-head text-sm font-extrabold text-nu-ink">{r.role_name}</span>
                  {r.specialty_tags.map((t) => (
                    <span
                      key={t}
                      className="font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-nu-ink/20 text-nu-graphite"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-nu-graphite m-0">{r.why}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Resources folders */}
      {plan.resources_folders && plan.resources_folders.length > 0 && (
        <section className="border-[3px] border-nu-ink bg-nu-paper p-6">
          <h2 className="font-head text-xl font-extrabold text-nu-ink tracking-tight uppercase mb-4 m-0">
            Resources Folders
          </h2>
          <div className="flex flex-wrap gap-2">
            {plan.resources_folders.map((f, i) => (
              <span
                key={i}
                className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink/20 text-nu-ink bg-nu-paper"
              >
                📁 {f}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* First tasks */}
      {plan.first_tasks && plan.first_tasks.length > 0 && (
        <section className="border-[3px] border-nu-ink bg-nu-paper p-6">
          <h2 className="font-head text-xl font-extrabold text-nu-ink tracking-tight uppercase mb-4 m-0">
            First Tasks
          </h2>
          <ul className="space-y-1 list-none p-0 m-0">
            {plan.first_tasks.map((t, i) => (
              <li key={i} className="text-sm text-nu-ink">
                ☐ {t}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
