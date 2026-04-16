export default function Loading() {
  return (
    <div className="min-h-screen bg-nu-paper flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-[3px] border-nu-ink border-t-nu-pink animate-spin mx-auto mb-4" />
        <p className="font-mono-nu text-[13px] uppercase tracking-widest text-nu-muted animate-pulse">
          Loading...
        </p>
      </div>
    </div>
  );
}
