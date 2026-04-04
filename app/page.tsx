import { Nav } from "@/components/shared/nav";
import { CustomCursor } from "@/components/shared/custom-cursor";
import { Hero } from "@/components/landing/hero";
import { Ticker } from "@/components/landing/ticker";
import { AboutBento } from "@/components/landing/about-bento";
import { GroupsPreview } from "@/components/landing/groups-preview";
import { JoinSection } from "@/components/landing/join-section";
import { Footer } from "@/components/landing/footer";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  let content: Record<string, Record<string, string>> = {};

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("page_content")
      .select("section, field_key, field_value")
      .eq("page", "landing");

    if (data) {
      for (const item of data) {
        if (!content[item.section]) content[item.section] = {};
        content[item.section][item.field_key] = item.field_value || "";
      }
    }
  } catch {
    // Supabase not configured yet - use defaults
  }

  return (
    <>
      <Nav />
      <CustomCursor />
      <main>
        <Hero content={content.hero} />
        <Ticker content={content.ticker} />
        <AboutBento content={content.about} />
        <GroupsPreview />
        <JoinSection content={content.join} />
      </main>
      <Footer content={content.footer} />
    </>
  );
}
