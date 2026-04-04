"use client";

import { useState } from "react";
import Link from "next/link";

const groups = [
  { name: "Space Architects Seoul", cat: "space", desc: "서울의 공간을 재해석하는 건축·인테리어 크루", m: 14, max: 20 },
  { name: "Vibe Curators", cat: "vibe", desc: "도시의 분위기를 포착하고 큐레이션���는 모임", m: 28, max: 40 },
  { name: "Platform Builders", cat: "platform", desc: "커뮤니티 플랫폼을 설계하고 구축하는 빌더 그룹", m: 9, max: 15 },
  { name: "Field Culture Lab", cat: "culture", desc: "현장 기반 문화 리서치 랩", m: 19, max: 25 },
  { name: "Property Protocol", cat: "space", desc: "부동산과 공간 프로토콜을 연구하는 네트워크", m: 33, max: 50 },
  { name: "Scene Makers Jeju", cat: "vibe", desc: "제주에서 새로운 Scene을 만드는 크루", m: 11, max: 20 },
  { name: "Open Source City", cat: "platform", desc: "도시 데이터와 오픈소스를 결합하는 시빅 테크 그룹", m: 22, max: 30 },
  { name: "Distressed Culture", cat: "culture", desc: "소외된 문화 콘텐츠를 발굴하고 재조명하는 모임", m: 16, max: 25 },
];

const filters = [
  { key: "all", label: "전체" },
  { key: "space", label: "Space" },
  { key: "culture", label: "Culture" },
  { key: "platform", label: "Platform" },
  { key: "vibe", label: "Vibe" },
];

const catColors: Record<string, { bg: string; text: string; bar: string }> = {
  space: { bg: "bg-nu-blue", text: "text-white", bar: "bg-nu-blue" },
  culture: { bg: "bg-nu-amber", text: "text-white", bar: "bg-nu-amber" },
  platform: { bg: "bg-nu-ink", text: "text-nu-paper", bar: "bg-nu-ink" },
  vibe: { bg: "bg-nu-pink", text: "text-white", bar: "bg-nu-pink" },
};

export function GroupsPreview() {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? groups : groups.filter((g) => g.cat === filter);

  return (
    <section id="groups" className="py-20 px-8 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="font-head text-4xl font-extrabold tracking-tight text-nu-ink">
          Scene을 만드는 크루들
        </h2>
        <p className="font-body text-nu-gray mt-3 text-sm">
          각자의 전문 분야에서 Scene을 만들어가는 소모임들
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 border-[1.5px] transition-colors ${
              filter === f.key
                ? "bg-nu-ink border-nu-ink text-nu-paper"
                : "bg-transparent border-nu-ink/20 text-nu-graphite hover:border-nu-ink/40"
            }`}
          >
            {f.label}
          </button>
        ))}
        <Link
          href="/signup"
          className="font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 border-[1.5px] border-nu-pink bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-colors no-underline ml-2"
        >
          + 소모임 만들기
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {filtered.map((g) => {
          const color = catColors[g.cat];
          const pct = Math.round((g.m / g.max) * 100);
          return (
            <div
              key={g.name}
              className="group-card bg-nu-white border border-nu-ink/[0.08] p-5 flex flex-col"
            >
              <span
                className={`inline-block self-start font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 mb-4 ${color.bg} ${color.text}`}
              >
                {g.cat}
              </span>
              <h3 className="font-head text-lg font-extrabold leading-tight mb-2">
                {g.name}
              </h3>
              <p className="font-body text-xs text-nu-gray leading-relaxed mb-4 flex-1">
                {g.desc}
              </p>
              <div className="mb-3">
                <div className="progress-bar">
                  <div
                    className={`progress-bar-fill ${color.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono-nu text-[10px] text-nu-muted mt-1.5 block">
                  {g.m}/{g.max} 멤버
                </span>
              </div>
              <Link
                href="/login"
                className="font-mono-nu text-[10px] font-bold uppercase tracking-[0.1em] text-center py-2.5 border border-nu-ink/20 text-nu-graphite hover:bg-nu-ink hover:text-nu-paper transition-colors no-underline block"
              >
                참여하기
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
