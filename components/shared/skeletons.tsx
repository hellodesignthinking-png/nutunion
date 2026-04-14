export function GroupSkeleton() {
  return (
    <div className="bg-nu-white border border-nu-ink/[0.08] flex flex-col overflow-hidden animate-pulse">
      {/* Header visual — matches h-32 gradient header in GroupsList card */}
      <div className="h-32 bg-nu-ink/5 relative">
        {/* Category badge placeholder */}
        <div className="absolute top-4 left-4 h-5 w-14 bg-nu-ink/10 rounded-sm" />
      </div>

      {/* Body — matches p-5 flex-col layout */}
      <div className="p-5 flex-1 flex flex-col">
        {/* Title */}
        <div className="h-5 bg-nu-ink/10 w-3/4 mb-2" />
        {/* Description (2 lines) */}
        <div className="h-3 bg-nu-ink/5 w-full mb-1.5" />
        <div className="h-3 bg-nu-ink/5 w-2/3 mb-4" />

        {/* Progress bar area */}
        <div className="mt-auto mb-4">
          <div className="h-1.5 bg-nu-ink/5 w-full mb-1.5" />
          <div className="flex items-center justify-between">
            <div className="h-3 bg-nu-ink/5 w-16" />
            <div className="h-3 bg-nu-ink/5 w-10" />
          </div>
        </div>

        {/* Footer — host name + action */}
        <div className="pt-4 border-t border-nu-ink/[0.05] flex items-center justify-between">
          <div className="h-3 bg-nu-ink/5 w-20" />
          <div className="h-3 bg-nu-ink/5 w-16" />
        </div>
      </div>
    </div>
  );
}

export function ProjectSkeleton() {
  return (
    <div className="bg-nu-white border border-nu-ink/[0.06] overflow-hidden flex flex-col animate-pulse">
      {/* Header visual — matches h-40 gradient header in ProjectsGrid card */}
      <div className="h-40 bg-nu-ink/5 relative">
        {/* Category + status badge placeholders */}
        <div className="absolute top-4 left-4 flex gap-2">
          <div className="h-5 w-16 bg-nu-ink/10 rounded-sm" />
          <div className="h-5 w-14 bg-nu-ink/10 rounded-sm" />
        </div>
      </div>

      {/* Body — matches p-5 flex-col layout */}
      <div className="p-5 flex-1 flex flex-col">
        {/* Title */}
        <div className="h-5 bg-nu-ink/10 w-3/4 mb-2" />
        {/* Description (3 lines) */}
        <div className="h-3 bg-nu-ink/5 w-full mb-1.5" />
        <div className="h-3 bg-nu-ink/5 w-full mb-1.5" />
        <div className="h-3 bg-nu-ink/5 w-1/2 mb-4" />

        {/* Date range placeholder */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-3 h-3 bg-nu-ink/5 rounded-full" />
          <div className="h-3 bg-nu-ink/5 w-28" />
        </div>

        {/* Footer — avatar + name + member count */}
        <div className="flex items-center justify-between pt-3 border-t border-nu-ink/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-nu-ink/5" />
            <div className="h-3 bg-nu-ink/5 w-20" />
          </div>
          <div className="h-3 bg-nu-ink/5 w-10" />
        </div>
      </div>
    </div>
  );
}
