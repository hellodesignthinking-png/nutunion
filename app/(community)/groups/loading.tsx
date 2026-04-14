// 너트 목록 — 스켈레톤 로딩
export default function GroupsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-28 bg-nu-ink/8 animate-pulse mb-2" />
          <div className="h-4 w-48 bg-nu-ink/5 animate-pulse" />
        </div>
        <div className="h-10 w-36 bg-nu-ink/8 animate-pulse" />
      </div>
      {/* 필터 */}
      <div className="flex gap-2 mb-6">
        {[80, 60, 70, 80, 60].map((w, i) => (
          <div key={i} className={`h-9 bg-nu-ink/5 animate-pulse`} style={{ width: w }} />
        ))}
      </div>
      {/* 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-nu-white border border-nu-ink/[0.08] overflow-hidden">
            <div className="h-1 bg-nu-ink/5" />
            <div className="p-5">
              <div className="flex justify-between mb-4">
                <div className="h-5 w-16 bg-nu-ink/8 animate-pulse" />
                <div className="h-4 w-20 bg-nu-ink/5 animate-pulse" />
              </div>
              <div className="h-6 w-3/4 bg-nu-ink/8 animate-pulse mb-2" />
              <div className="h-4 w-full bg-nu-ink/5 animate-pulse mb-1" />
              <div className="h-4 w-2/3 bg-nu-ink/5 animate-pulse mb-5" />
              <div className="h-1.5 bg-nu-ink/5 animate-pulse mb-2" />
              <div className="h-9 bg-nu-ink/5 animate-pulse mt-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
