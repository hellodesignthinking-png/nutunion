export default function ChallengesLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-12">
      <div className="h-8 w-56 bg-nu-ink/8 animate-pulse mb-3" />
      <div className="h-4 w-80 bg-nu-ink/5 animate-pulse mb-8" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-nu-white border border-nu-ink/[0.08] h-36 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
