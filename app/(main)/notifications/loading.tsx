export default function NotificationsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="h-8 w-48 bg-nu-ink/5 animate-pulse mb-8" />
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-9 w-20 bg-nu-ink/5 animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-white border border-nu-ink/[0.06] p-4 flex items-start gap-3">
            <div className="w-10 h-10 bg-nu-ink/5 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-nu-ink/5 animate-pulse" />
              <div className="h-3 w-1/2 bg-nu-ink/5 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
