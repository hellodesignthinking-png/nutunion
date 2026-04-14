export default function MembersLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-12">
      <div className="h-8 w-48 bg-nu-ink/8 animate-pulse mb-3" />
      <div className="h-4 w-72 bg-nu-ink/5 animate-pulse mb-8" />
      <div className="h-10 w-full bg-nu-ink/5 animate-pulse mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-nu-white border border-nu-ink/[0.08] h-32 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
