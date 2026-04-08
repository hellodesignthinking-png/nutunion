import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/landing/footer";

export default function GroupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-nu-paper flex flex-col">
      <Nav />
      <main className="flex-1 mt-[60px]">
        {children}
      </main>
      <Footer />
    </div>
  );
}
