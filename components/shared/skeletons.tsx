export function GroupSkeleton() {
  return (
    <div className="bg-nu-white border border-nu-ink/[0.08] flex flex-col animate-pulse">
      <div className="h-32 bg-nu-ink/5" />
      <div className="p-5 flex-1 flex flex-col gap-4">
        <div>
          <div className="h-6 bg-nu-ink/10 w-3/4 mb-2" />
          <div className="h-4 bg-nu-ink/5 w-full" />
        </div>
        <div className="mt-auto">
          <div className="h-1.5 bg-nu-ink/5 w-full mb-2" />
          <div className="flex justify-between">
            <div className="h-3 bg-nu-ink/5 w-12" />
            <div className="h-3 bg-nu-ink/5 w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectSkeleton() {
  return (
    <div className="bg-nu-white border border-nu-ink/[0.08] p-6 animate-pulse">
      <div className="flex justify-between mb-4">
        <div className="h-4 bg-nu-ink/5 w-16" />
        <div className="h-4 bg-nu-ink/5 w-16" />
      </div>
      <div className="h-6 bg-nu-ink/10 w-3/4 mb-3" />
      <div className="h-4 bg-nu-ink/5 w-full mb-6" />
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-nu-ink/5" />
        <div className="h-3 bg-nu-ink/5 w-20" />
      </div>
    </div>
  );
}
