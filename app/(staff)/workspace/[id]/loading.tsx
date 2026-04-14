export default function StaffProjectDetailLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
      <div className="h-3 w-24 bg-nu-ink/5 animate-pulse mb-4" />
      <div className="h-8 w-64 bg-nu-ink/8 animate-pulse mb-2" />
      <div className="h-4 w-96 bg-nu-ink/5 animate-pulse mb-8" />
      <div className="flex gap-4 border-b border-nu-ink/[0.06] mb-8 pb-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-4 w-16 bg-nu-ink/5 animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 bg-white border border-nu-ink/[0.06] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
