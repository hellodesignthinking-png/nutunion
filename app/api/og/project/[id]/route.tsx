import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { rngFromSeed } from "@/lib/art/prng";
import { drawGrammar, type Category, type Palette } from "@/lib/art/grammar";
import { getTodayGenre } from "@/tokens/liquid";
import { foundation } from "@/tokens/foundation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const size = { width: 1200, height: 630 };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("title, description, category, status")
    .eq("id", id)
    .maybeSingle();

  const title = project?.title || "nutunion 볼트";
  const description = (project?.description || "Protocol Collective").slice(0, 80);
  const catRaw = project?.category || "platform";
  const category = (["space", "culture", "platform", "vibe"].includes(catRaw) ? catRaw : "platform") as Category;
  const status = project?.status || "active";

  const genre = getTodayGenre();
  const palette: Palette = {
    primary: genre.primary,
    secondary: genre.secondary,
    surface: genre.surface,
    ink: foundation.neutral[900],
  };
  const rng = rngFromSeed(`project::${id}::${genre.key}`);
  const svgChildren = drawGrammar(category, rng, 630, palette);

  const svgBody = svgChildren
    .map((c) => {
      const attrs = Object.entries(c.attrs).map(([k, v]) => `${k}="${v}"`).join(" ");
      return `<${c.tag} ${attrs}/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 630 630" width="630" height="630"><defs><filter id="blur-lg"><feGaussianBlur stdDeviation="50"/></filter></defs>${svgBody}</svg>`;
  const svgUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", fontFamily: "sans-serif" }}>
        {/* Top strip: generative band */}
        <div style={{ width: "100%", height: 160, display: "flex", background: palette.surface }}>
          <img src={svgUrl} width={1200} height={160} style={{ objectFit: "cover", objectPosition: "center" }} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 72px", color: foundation.neutral[900] }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: palette.primary, display: "flex" }}>
                볼트
              </div>
              <div style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.2em", color: foundation.neutral[500], padding: "4px 10px", border: `1.5px solid ${foundation.neutral[200]}`, display: "flex" }}>
                {status}
              </div>
              <div style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.2em", color: foundation.neutral[500], display: "flex" }}>
                {category}
              </div>
            </div>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 24, display: "flex" }}>
              {title}
            </div>
            <div style={{ fontSize: 22, lineHeight: 1.5, color: foundation.neutral[500], display: "flex", maxWidth: 900 }}>
              {description}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 16, color: foundation.neutral[700], marginTop: 24 }}>
            <div style={{ width: 28, height: 28, background: palette.primary, color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
              ⊕
            </div>
            <span style={{ fontWeight: 700 }}>nutunion.co.kr</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Protocol Collective</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
