import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-nu-pink" size={28} />
        <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">
          Loading...
        </span>
      </div>
    </div>
  );
}
