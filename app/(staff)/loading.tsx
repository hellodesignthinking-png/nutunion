export default function StaffLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
      <div className="h-8 w-56 bg-nu-ink/8 animate-pulse mb-2" />
      <div className="h-3 w-40 bg-nu-ink/5 animate-pulse mb-10" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-nu-ink/[0.06] h-16 animate-pulse" />
          ))}
        </div>
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-nu-ink/[0.06] h-48 animate-pulse" />
          <div className="bg-white border border-nu-ink/[0.06] h-48 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
