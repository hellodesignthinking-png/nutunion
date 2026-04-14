export default function CommunityLoading() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      <div className="mb-8">
        <div className="h-3 w-24 bg-nu-ink/5 animate-pulse mb-4" />
        <div className="h-8 w-1/2 bg-nu-ink/8 animate-pulse mb-3" />
        <div className="h-4 w-full bg-nu-ink/5 animate-pulse mb-1" />
        <div className="h-4 w-3/4 bg-nu-ink/5 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-nu-white border border-nu-ink/[0.08] h-44 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
