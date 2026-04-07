// 프로젝트 상세 — 스켈레톤
export default function ProjectDetailLoading() {
  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1">
          <div className="flex gap-2 mb-3">
            <div className="h-6 w-16 bg-nu-ink/8 animate-pulse" />
            <div className="h-6 w-20 bg-nu-ink/5 animate-pulse" />
          </div>
          <div className="h-9 w-3/4 bg-nu-ink/8 animate-pulse mb-2" />
          <div className="h-5 w-full bg-nu-ink/5 animate-pulse mb-1" />
          <div className="h-5 w-2/3 bg-nu-ink/5 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-12 w-24 bg-nu-ink/8 animate-pulse" />
          <div className="h-12 w-24 bg-nu-ink/5 animate-pulse" />
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-4 border-b border-nu-ink/[0.08] mb-6">
        {[4, 5, 3].map((w, i) => (
          <div key={i} className={`h-10 bg-nu-ink/5 animate-pulse`} style={{ width: w * 24 }} />
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-nu-white border border-nu-ink/[0.08] h-64 animate-pulse" />
          <div className="bg-nu-white border border-nu-ink/[0.08] h-48 animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="bg-nu-white border border-nu-ink/[0.08] h-44 animate-pulse" />
          <div className="bg-nu-white border border-nu-ink/[0.08] h-36 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
