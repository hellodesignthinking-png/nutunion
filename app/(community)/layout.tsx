import { ClientNav } from "@/components/shared/client-nav";

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-nu-paper flex flex-col">
      <ClientNav />
      <div className="flex-1 pt-[60px]">
        {children}
      </div>
      {/* Footer removed for diagnosis */}
    </div>
  );
}
