import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/landing/footer";

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-nu-paper flex flex-col">
      <Nav />
      {/* 
          Nav is 60px height. 
          To make Group/Project list start at same position, 
          we use a single wrapper with pt-[60px].
      */}
      <div className="flex-1 pt-[60px]">
        {children}
      </div>
      <Footer />
    </div>
  );
}
