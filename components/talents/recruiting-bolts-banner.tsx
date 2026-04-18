"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Bolt {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  needed_roles: string[];
  recruiting_note: string | null;
}

export function RecruitingBoltsBanner() {
  const [items, setItems] = useState<Bolt[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("projects")
        .select("id, title, description, category, needed_roles, recruiting_note")
        .eq("recruiting", true)
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(12);
      setItems((data as Bolt[]) ?? []);
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return null;
  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink">
            🔎 Bolts Recruiting
          </div>
          <h2 className="text-[18px] sm:text-[20px] font-bold text-nu-ink mt-0.5">
            지금 팀원을 찾는 볼트 ({items.length})
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((b) => (
          <Link
            key={b.id}
            href={`/projects/${b.id}`}
            className="border-[2.5px] border-nu-ink bg-nu-paper p-4 no-underline hover:shadow-[4px_4px_0_0_rgba(255,61,136,1)] hover:-translate-y-0.5 transition-transform"
          >
            {b.category && (
              <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite mb-1">
                {b.category}
              </div>
            )}
            <h3 className="text-[15px] font-bold text-nu-ink mb-2 leading-tight">{b.title}</h3>
            {b.description && (
              <p className="text-[12px] text-nu-graphite leading-snug line-clamp-2 mb-2">
                {b.description}
              </p>
            )}

            {b.needed_roles && b.needed_roles.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {b.needed_roles.slice(0, 6).map((r) => (
                  <span
                    key={r}
                    className="inline-block border-[1.5px] border-nu-ink bg-nu-pink text-nu-paper px-1.5 py-0.5 font-mono-nu text-[9px] uppercase tracking-wider"
                  >
                    {r}
                  </span>
                ))}
                {b.needed_roles.length > 6 && (
                  <span className="text-[10px] text-nu-graphite">+{b.needed_roles.length - 6}</span>
                )}
              </div>
            )}

            {b.recruiting_note && (
              <p className="text-[11px] text-nu-ink italic border-l-[2px] border-nu-pink pl-2">
                &ldquo;{b.recruiting_note.slice(0, 120)}{b.recruiting_note.length > 120 ? "..." : ""}&rdquo;
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
