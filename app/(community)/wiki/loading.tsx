export default function WikiLoading() {
  return (
    <>
      {/* Hero skeleton */}
      <div className="relative bg-nu-ink overflow-hidden border-b border-nu-paper/10">
        <div className="max-w-7xl mx-auto px-8 pt-20 pb-12 md:pt-28 md:pb-16">
          <div className="h-3 w-28 bg-nu-paper/10 mb-4 animate-pulse" />
          <div className="h-12 w-64 bg-nu-paper/10 mb-5 animate-pulse" />
          <div className="h-4 w-80 bg-nu-paper/5 animate-pulse" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-8 py-10">
        {/* Filter bar skeleton */}
        <div className="flex gap-2 mb-10 pb-6 border-b-[2px] border-nu-ink/10">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-20 bg-nu-ink/[0.06] border-[2px] border-nu-ink/10 animate-pulse"
            />
          ))}
        </div>

        {/* Card grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border-[2px] border-nu-ink/[0.08] p-5 animate-pulse"
            >
              {/* Group badge */}
              <div className="h-4 w-16 bg-nu-ink/[0.06] mb-3" />
              {/* Title */}
              <div className="h-5 w-3/4 bg-nu-ink/[0.08] mb-2" />
              {/* Preview lines */}
              <div className="h-3 w-full bg-nu-ink/[0.04] mb-1.5" />
              <div className="h-3 w-5/6 bg-nu-ink/[0.04] mb-1.5" />
              <div className="h-3 w-2/3 bg-nu-ink/[0.04] mb-4" />
              {/* Author row */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded-full bg-nu-ink/[0.06]" />
                <div className="h-3 w-16 bg-nu-ink/[0.04]" />
              </div>
              {/* Stats row */}
              <div className="pt-3 border-t border-nu-ink/[0.06] flex justify-between">
                <div className="h-3 w-24 bg-nu-ink/[0.04]" />
                <div className="h-3 w-20 bg-nu-ink/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
