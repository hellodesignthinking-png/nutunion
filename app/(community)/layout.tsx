export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-nu-paper flex flex-col">
      {/* Nav 제거 — 진단 */}
      <div className="h-[60px] bg-gray-900 text-white flex items-center px-8 text-sm font-mono">
        DIAGNOSTIC MODE — Nav removed | <a href="/" className="text-pink-400 ml-2 underline">Home</a>
      </div>
      <div className="flex-1">
        {children}
      </div>
      {/* Footer 제거 — 진단 */}
    </div>
  );
}
