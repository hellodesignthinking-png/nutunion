import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/landing/footer";

export default function ProjectsLoading() {
  return (
    <div className="min-h-screen bg-nu-paper">
      <Nav />
      {/* Hero Skeleton */}
      <div className="relative bg-nu-ink overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-nu-blue/15 via-nu-ink to-nu-pink/10 animate-pulse" />
        <div className="relative max-w-7xl mx-auto px-8 pt-28 pb-16">
          <div className="w-24 h-4 bg-nu-blue/20 rounded mb-4" />
          <div className="w-48 h-12 bg-nu-paper/10 rounded mb-4" />
          <div className="w-80 h-4 bg-nu-paper/10 rounded mb-8" />
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-nu-white border border-nu-ink/[0.06] rounded-none overflow-hidden flex flex-col h-[480px]">
              <div className="h-48 bg-nu-ink/5 animate-pulse" />
              <div className="p-6 flex-1 space-y-4">
                <div className="w-20 h-4 bg-nu-ink/5 rounded mb-2" />
                <div className="w-3/4 h-7 bg-nu-ink/5 rounded" />
                <div className="w-full h-16 bg-nu-ink/5 rounded" />
                <div className="flex gap-2 mt-4">
                  <div className="w-6 h-6 rounded-full bg-nu-ink/5" />
                  <div className="w-20 h-4 bg-nu-ink/5 rounded" />
                </div>
                <div className="w-full h-2 bg-nu-ink/5 rounded mt-auto" />
                <div className="flex justify-between mt-2">
                  <div className="w-16 h-3 bg-nu-ink/5 rounded" />
                  <div className="w-20 h-3 bg-nu-ink/5 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
