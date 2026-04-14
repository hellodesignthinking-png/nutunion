export default function StaffProjectsLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
      <div className="h-8 w-40 bg-nu-ink/8 animate-pulse mb-2" />
      <div className="h-3 w-32 bg-nu-ink/5 animate-pulse mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white border border-nu-ink/[0.06] h-48 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
