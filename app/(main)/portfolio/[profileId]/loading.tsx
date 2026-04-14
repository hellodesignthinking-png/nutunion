export default function PortfolioLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-12">
      <div className="flex items-center gap-6 mb-8">
        <div className="w-20 h-20 rounded-full bg-nu-ink/8 animate-pulse" />
        <div>
          <div className="h-7 w-36 bg-nu-ink/8 animate-pulse mb-2" />
          <div className="h-4 w-48 bg-nu-ink/5 animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-nu-white border border-nu-ink/[0.08] h-64 animate-pulse" />
          <div className="bg-nu-white border border-nu-ink/[0.08] h-48 animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="bg-nu-white border border-nu-ink/[0.08] h-52 animate-pulse" />
          <div className="bg-nu-white border border-nu-ink/[0.08] h-36 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
