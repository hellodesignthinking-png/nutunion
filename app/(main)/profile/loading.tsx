export default function ProfileLoading() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Cover + Avatar area */}
      <div className="h-48 bg-gradient-to-r from-nu-ink/5 to-nu-pink/5 animate-pulse mb-6" />
      <div className="flex items-end gap-4 -mt-12 mb-8 px-4">
        <div className="w-20 h-20 rounded-full bg-nu-ink/10 animate-pulse border-4 border-white" />
        <div className="space-y-2 pb-1">
          <div className="h-6 w-40 bg-nu-ink/5 animate-pulse" />
          <div className="h-4 w-24 bg-nu-ink/5 animate-pulse" />
        </div>
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-nu-ink/[0.06] p-6">
              <div className="h-5 w-32 bg-nu-ink/5 animate-pulse mb-4" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-nu-ink/5 animate-pulse" />
                <div className="h-4 w-3/4 bg-nu-ink/5 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white border border-nu-ink/[0.06] p-6 h-48 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
