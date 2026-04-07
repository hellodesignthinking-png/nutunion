export default function NotificationsLoading() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex justify-between mb-6">
        <div>
          <div className="h-8 w-16 bg-nu-ink/8 animate-pulse mb-2" />
          <div className="h-4 w-32 bg-nu-ink/5 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-nu-ink/5 animate-pulse" />
        </div>
      </div>
      <div className="flex gap-4 border-b border-nu-ink/[0.08] mb-6">
        <div className="h-10 w-24 bg-nu-ink/5 animate-pulse" />
        <div className="h-10 w-28 bg-nu-ink/5 animate-pulse" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-nu-white border border-nu-ink/[0.06] p-4 flex gap-4">
            <div className="w-10 h-10 bg-nu-ink/5 animate-pulse shrink-0" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-nu-ink/8 animate-pulse mb-2" />
              <div className="h-3 w-64 bg-nu-ink/5 animate-pulse mb-2" />
              <div className="h-3 w-16 bg-nu-ink/5 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
