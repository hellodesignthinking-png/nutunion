import dynamic from "next/dynamic";
import { Nav } from "@/components/shared/nav";
import { Hero } from "@/components/landing/hero";
import { Ticker } from "@/components/landing/ticker";
import { createClient } from "@/lib/supabase/server";

const CustomCursor = dynamic(() => import("@/components/shared/custom-cursor").then(m => ({ default: m.CustomCursor })));
const FullImageSection = dynamic(() => import("@/components/landing/full-image-section").then(m => ({ default: m.FullImageSection })));
const FeaturesSection = dynamic(() => import("@/components/landing/features-section").then(m => ({ default: m.FeaturesSection })));
const AboutBento = dynamic(() => import("@/components/landing/about-bento").then(m => ({ default: m.AboutBento })));
const SceneGallery = dynamic(() => import("@/components/landing/scene-gallery").then(m => ({ default: m.SceneGallery })));
const ShowcaseSection = dynamic(() => import("@/components/landing/showcase-section").then(m => ({ default: m.ShowcaseSection })));
const StatsBanner = dynamic(() => import("@/components/landing/stats-banner").then(m => ({ default: m.StatsBanner })));
const VideoSection = dynamic(() => import("@/components/landing/video-section").then(m => ({ default: m.VideoSection })));
const GroupsPreview = dynamic(() => import("@/components/landing/groups-preview").then(m => ({ default: m.GroupsPreview })));
const ProjectsPreview = dynamic(() => import("@/components/landing/projects-preview").then(m => ({ default: m.ProjectsPreview })));
const TestimonialsSection = dynamic(() => import("@/components/landing/testimonials-section").then(m => ({ default: m.TestimonialsSection })));
const JoinSection = dynamic(() => import("@/components/landing/join-section").then(m => ({ default: m.JoinSection })));
const Footer = dynamic(() => import("@/components/landing/footer").then(m => ({ default: m.Footer })));

export default async function LandingPage() {
  let content: Record<string, Record<string, string>> = {};
  let liveGroups: any[] = [];
  let liveProjects: any[] = [];
  let stats = { crews: 0, members: 0, projects: 0, events: 0 };

  try {
    const supabase = await createClient();

    // CMS content
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

    // Live groups for preview
    const { data: groups } = await supabase
      .from("groups")
      .select("id, name, category, description, max_members, group_members(count)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(8);

    liveGroups = (groups || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      cat: g.category,
      desc: g.description || "",
      m: g.group_members?.[0]?.count || 0,
      max: g.max_members,
    }));

    // Live projects
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, description, status, category, start_date, end_date, project_members(count)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(4);

    liveProjects = (projects || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description || "",
      status: p.status,
      category: p.category,
      memberCount: p.project_members?.[0]?.count || 0,
    }));

    // Real stats
    const { count: crewCount } = await supabase.from("groups").select("*", { count: "exact", head: true }).eq("is_active", true);
    const { count: memberCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    const { count: projectCount } = await supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "active");
    const { count: eventCount } = await supabase.from("events").select("*", { count: "exact", head: true });

    stats = {
      crews: crewCount || 0,
      members: memberCount || 0,
      projects: projectCount || 0,
      events: eventCount || 0,
    };
  } catch {
    // Supabase not configured
  }

  return (
    <>
      <Nav />
      <CustomCursor />
      <main>
        <Hero content={content.hero} />
        <Ticker content={content.ticker} />
        <FullImageSection />
        <FeaturesSection />
        <AboutBento content={content.about} />
        <SceneGallery />
        <ShowcaseSection />
        <StatsBanner stats={stats} />
        <VideoSection content={content.video} />
        <GroupsPreview groups={liveGroups} />
        <ProjectsPreview projects={liveProjects} />
        <TestimonialsSection />
        <JoinSection content={content.join} />
      </main>
      <Footer content={content.footer} />
    </>
  );
}
