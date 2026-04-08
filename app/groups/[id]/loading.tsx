// 소모임 상세 — 스켈레톤
export default function GroupDetailLoading() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="h-2 w-full bg-nu-ink/5 animate-pulse mb-6" />
        <div className="flex gap-3 mb-4">
          <div className="h-6 w-16 bg-nu-ink/8 animate-pulse" />
          <div className="h-6 w-20 bg-nu-ink/5 animate-pulse" />
        </div>
        <div className="h-9 w-2/3 bg-nu-ink/8 animate-pulse mb-3" />
        <div className="h-5 w-full bg-nu-ink/5 animate-pulse mb-1" />
        <div className="h-5 w-4/5 bg-nu-ink/5 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 메인 콘텐츠 */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-nu-white border border-nu-ink/[0.08] h-56 animate-pulse" />
          <div className="bg-nu-white border border-nu-ink/[0.08] h-40 animate-pulse" />
        </div>
        {/* 사이드바 */}
        <div className="space-y-5">
          <div className="bg-nu-white border border-nu-ink/[0.08] h-36 animate-pulse" />
          <div className="bg-nu-white border border-nu-ink/[0.08] h-48 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
