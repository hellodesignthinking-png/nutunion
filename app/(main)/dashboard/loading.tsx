// 대시보드 — 스켈레톤 로딩
export default function DashboardLoading() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-52 bg-nu-ink/8 animate-pulse mb-2" />
          <div className="h-4 w-36 bg-nu-ink/5 animate-pulse" />
        </div>
        <div className="h-10 w-28 bg-nu-ink/5 animate-pulse" />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-nu-white border border-nu-ink/[0.08] p-5">
            <div className="h-4 w-16 bg-nu-ink/5 animate-pulse mb-2" />
            <div className="h-8 w-10 bg-nu-ink/8 animate-pulse" />
          </div>
        ))}
      </div>

      {/* 메인 콘텐츠 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-nu-white border border-nu-ink/[0.08] p-6 h-48 animate-pulse" />
          <div className="bg-nu-white border border-nu-ink/[0.08] p-6 h-64 animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="bg-nu-white border border-nu-ink/[0.08] p-5 h-40 animate-pulse" />
          <div className="bg-nu-white border border-nu-ink/[0.08] p-5 h-56 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
