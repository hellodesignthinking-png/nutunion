export default function ProfileLoading() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Hero card */}
      <div className="bg-nu-white border border-nu-ink/[0.08] mb-6">
        <div className="h-20 bg-nu-ink/5 animate-pulse" />
        <div className="px-8 pb-6">
          <div className="flex items-end justify-between -mt-10 mb-4">
            <div className="w-20 h-20 rounded-full bg-nu-ink/8 animate-pulse border-4 border-nu-white" />
            <div className="h-9 w-28 bg-nu-ink/5 animate-pulse" />
          </div>
          <div className="h-7 w-40 bg-nu-ink/8 animate-pulse mb-2" />
          <div className="h-4 w-56 bg-nu-ink/5 animate-pulse" />
        </div>
      </div>
      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-5">
          <div className="bg-nu-white border border-nu-ink/[0.08] h-52 animate-pulse" />
          <div className="bg-nu-white border border-nu-ink/[0.08] h-36 animate-pulse" />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-nu-white border border-nu-ink/[0.08] h-64 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
