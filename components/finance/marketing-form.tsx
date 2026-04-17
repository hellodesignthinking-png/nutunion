"use client";

import { useState, useMemo, useEffect } from "react";

interface BoltMin {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
}

interface CompanyMin {
  id: string;
  name: string;
  label?: string | null;
  biz_type?: string | null;
  color?: string | null;
  icon?: string | null;
}

interface MarketingResult {
  id: number;
  success: boolean;
  contentType: string;
  contentTypeLabel: string;
  content: string;
  entityType: "bolt" | "company";
  entityId: string;
  entityName: string;
  topic: string;
  tone?: string;
  target?: string;
  generatedAt: string;
}

const CONTENT_TYPES = [
  { id: "blog", label: "블로그", icon: "📝", desc: "SEO 블로그 글" },
  { id: "sns", label: "SNS", icon: "📱", desc: "인스타/페북" },
  { id: "newsletter", label: "뉴스레터", icon: "📧", desc: "이메일" },
  { id: "ad", label: "광고 카피", icon: "🎯", desc: "퍼포먼스" },
  { id: "press", label: "보도자료", icon: "📰", desc: "언론" },
  { id: "campaign", label: "캠페인", icon: "📅", desc: "기획안" },
];

const TONES = ["전문적/신뢰감", "친근함/친숙", "혁신적/미래지향", "고급스러움/프리미엄", "활기참/에너지"];

export function MarketingForm({ bolts, companies }: { bolts: BoltMin[]; companies: CompanyMin[] }) {
  const [entityType, setEntityType] = useState<"bolt" | "company">("bolt");
  const [entityId, setEntityId] = useState<string>("");
  const [contentType, setContentType] = useState("blog");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("전문적/신뢰감");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<MarketingResult[]>([]);
  const [selected, setSelected] = useState<MarketingResult | null>(null);

  // 법인에서 "all"은 제외 (AI 컨텍스트에 유용하지 않음)
  const entityList = entityType === "bolt" ? bolts : companies.filter((c) => c.id !== "all");
  const selectedEntity = useMemo(() => {
    if (!entityId) return null;
    return entityList.find((e) => e.id === entityId) || null;
  }, [entityId, entityList]);

  const entityName = (e: BoltMin | CompanyMin): string => {
    return "title" in e ? e.title : e.name;
  };

  // 이력 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nutunion_marketing_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const handleGenerate = async () => {
    if (!entityId) { setError("대상을 선택하세요"); return; }
    if (!topic.trim()) { setError("콘텐츠 주제를 입력하세요"); return; }
    setError(null);
    setLoading(true);
    setSelected(null);
    try {
      const res = await fetch("/api/finance/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, contentType, topic: topic.trim(), tone, target: target.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "생성 실패");

      const entry: MarketingResult = {
        id: Date.now(),
        ...data,
        entityName: selectedEntity ? entityName(selectedEntity) : "",
        tone,
        target,
      };
      const next = [entry, ...history].slice(0, 50);
      setHistory(next);
      localStorage.setItem("nutunion_marketing_history", JSON.stringify(next));
      setSelected(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const deleteHistory = (id: number) => {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    localStorage.setItem("nutunion_marketing_history", JSON.stringify(next));
    if (selected?.id === id) setSelected(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,380px)_1fr] gap-6">
      {/* 좌측 폼 */}
      <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5 h-fit">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink mb-4">
          콘텐츠 생성
        </div>

        <div className="flex flex-col gap-4">
          {/* 대상 유형 */}
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">대상 *</div>
            <div className="flex gap-2 mb-2">
              {([
                { id: "bolt", label: "볼트" },
                { id: "company", label: "법인" },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setEntityType(t.id); setEntityId(""); }}
                  className={`flex-1 border-[2.5px] border-nu-ink px-3 py-2 font-mono-nu text-[11px] uppercase tracking-wider ${
                    entityType === t.id ? "bg-nu-ink text-nu-paper" : "bg-nu-paper text-nu-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="w-full border-[2.5px] border-nu-ink bg-nu-paper px-3 py-2.5 text-[14px] text-nu-ink outline-none"
            >
              <option value="">{entityType === "bolt" ? "볼트" : "법인"} 선택</option>
              {entityList.map((e) => (
                <option key={e.id} value={e.id}>
                  {entityName(e)}
                  {entityType === "bolt" && "category" in e && e.category ? ` (${e.category})` : ""}
                  {entityType === "company" && "biz_type" in e && e.biz_type ? ` (${e.biz_type})` : ""}
                </option>
              ))}
            </select>
            {selectedEntity && entityType === "company" && "biz_type" in selectedEntity && !selectedEntity.biz_type && (
              <div className="mt-2 text-[10px] text-orange-600">
                ⚠ 법인 업종이 입력되어 있지 않습니다. 업종 정보가 있으면 더 정확한 콘텐츠가 생성됩니다.
              </div>
            )}
          </div>

          {/* 콘텐츠 유형 */}
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">콘텐츠 유형 *</div>
            <div className="grid grid-cols-3 gap-1.5">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setContentType(t.id)}
                  className={`border-[2px] p-2 text-center ${
                    contentType === t.id
                      ? "border-nu-ink bg-nu-ink/10"
                      : "border-nu-ink/30 bg-nu-paper hover:border-nu-ink"
                  }`}
                >
                  <div className="text-[16px]">{t.icon}</div>
                  <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-ink mt-0.5">
                    {t.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 주제 */}
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">주제 *</div>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder="예: 2026년 상반기 신규 서비스 출시 안내"
              className="w-full border-[2.5px] border-nu-ink bg-nu-paper px-3 py-2.5 text-[14px] text-nu-ink outline-none resize-y"
            />
          </div>

          {/* 톤 */}
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">톤앤매너</div>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full border-[2.5px] border-nu-ink bg-nu-paper px-3 py-2.5 text-[14px] text-nu-ink outline-none"
            >
              {TONES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* 타겟 */}
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">타겟 고객 (선택)</div>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="예: 30~40대 직장인"
              className="w-full border-[2.5px] border-nu-ink bg-nu-paper px-3 py-2.5 text-[14px] text-nu-ink outline-none"
            />
          </div>

          {error && (
            <div className="border-[2px] border-red-500 bg-red-50 text-red-600 p-3 text-[12px]">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !entityId || !topic.trim()}
            className={`border-[2.5px] border-nu-ink px-4 py-3 font-mono-nu text-[12px] uppercase tracking-widest ${
              loading || !entityId || !topic.trim()
                ? "bg-nu-ink/10 text-nu-graphite cursor-not-allowed"
                : "bg-nu-pink text-nu-paper hover:bg-nu-ink"
            }`}
          >
            {loading ? "✨ 생성 중..." : "✨ AI 콘텐츠 생성"}
          </button>
        </div>
      </div>

      {/* 우측 결과 + 이력 */}
      <div className="flex flex-col gap-4">
        {selected && (
          <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5">
            <div className="flex justify-between items-start mb-3 flex-wrap gap-3">
              <div>
                <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink">
                  {selected.contentTypeLabel}
                </div>
                <div className="text-[10px] text-nu-graphite mt-1">
                  {selected.entityType === "bolt" ? "볼트" : "법인"} · {selected.entityName} · {new Date(selected.generatedAt).toLocaleString("ko-KR")}
                </div>
              </div>
              <button
                onClick={() => handleCopy(selected.content)}
                className="border-[2px] border-nu-ink bg-nu-paper px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-wider hover:bg-nu-ink hover:text-nu-paper"
              >
                📋 복사
              </button>
            </div>
            <div className="text-[10px] text-nu-graphite mb-3 p-2 bg-nu-ink/5">
              주제: {selected.topic}
            </div>
            <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-nu-ink bg-nu-ink/[0.03] p-4 max-h-[600px] overflow-y-auto border-[1px] border-nu-ink/10">
              {selected.content}
            </div>
          </div>
        )}

        {/* 이력 */}
        <div className="border-[2.5px] border-nu-ink bg-nu-paper overflow-hidden">
          <div className="px-4 py-3 border-b-[2px] border-nu-ink flex justify-between items-center">
            <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
              생성 이력 {history.length > 0 && `(${history.length})`}
            </div>
            {history.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("전체 이력을 삭제하시겠습니까?")) {
                    setHistory([]);
                    localStorage.removeItem("nutunion_marketing_history");
                    setSelected(null);
                  }
                }}
                className="font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite hover:text-red-600"
              >
                전체 삭제
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-nu-graphite">
              아직 생성된 콘텐츠가 없습니다
            </div>
          ) : (
            <div className="divide-y divide-nu-ink/10 max-h-[400px] overflow-y-auto">
              {history.map((h) => {
                const typeInfo = CONTENT_TYPES.find((t) => t.id === h.contentType);
                const active = selected?.id === h.id;
                return (
                  <div
                    key={h.id}
                    onClick={() => setSelected(h)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${active ? "bg-nu-ink/5" : "hover:bg-nu-ink/[0.02]"}`}
                  >
                    <div className="text-[18px]">{typeInfo?.icon || "📄"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold text-nu-ink truncate">{h.topic}</div>
                      <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">
                        {h.entityName} · {h.contentTypeLabel} · {new Date(h.generatedAt).toLocaleDateString("ko-KR")}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteHistory(h.id); }}
                      className="text-nu-graphite hover:text-red-600 text-[14px] p-1"
                    >×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
