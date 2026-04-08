import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/landing/footer";

export default function CrewsLoading() {
  return (
    <div className="min-h-screen bg-nu-paper">
      <Nav />
      {/* Hero Skeleton */}
      <div className="relative bg-nu-ink overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-nu-pink/15 via-nu-ink to-nu-blue/10 animate-pulse" />
        <div className="relative max-w-7xl mx-auto px-8 pt-28 pb-16">
          <div className="w-24 h-4 bg-nu-pink/20 rounded mb-4" />
          <div className="w-64 h-12 bg-nu-paper/10 rounded mb-4" />
          <div className="w-96 h-4 bg-nu-paper/10 rounded mb-8" />
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="flex gap-2 mb-10 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-20 h-10 bg-nu-ink/5 rounded shrink-0" />
          ))}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-nu-white border border-nu-ink/[0.06] rounded-none overflow-hidden flex flex-col h-[420px]">
              <div className="h-40 bg-nu-ink/5 animate-pulse" />
              <div className="p-5 flex-1 space-y-4">
                <div className="w-3/4 h-6 bg-nu-ink/5 rounded" />
                <div className="w-full h-16 bg-nu-ink/5 rounded" />
                <div className="w-24 h-4 bg-nu-ink/5 rounded" />
                <div className="w-full h-2 bg-nu-ink/5 rounded mt-4" />
                <div className="w-full h-10 bg-nu-ink/5 rounded mt-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
