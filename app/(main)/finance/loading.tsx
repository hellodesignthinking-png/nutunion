export default function FinanceLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="animate-pulse">
        <div className="h-4 w-32 bg-nu-ink/10 mb-3" />
        <div className="h-8 w-64 bg-nu-ink/10 mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border-[2.5px] border-nu-ink/20 bg-nu-paper p-4">
              <div className="h-3 w-16 bg-nu-ink/10 mb-3" />
              <div className="h-6 w-24 bg-nu-ink/10" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="border-[2.5px] border-nu-ink/20 bg-nu-paper p-5 h-[220px]">
              <div className="h-4 w-12 bg-nu-ink/10 mb-2" />
              <div className="h-6 w-32 bg-nu-ink/10 mb-4" />
              <div className="h-20 bg-nu-ink/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
