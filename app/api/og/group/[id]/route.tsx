import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { rngFromSeed } from "@/lib/art/prng";
import { drawGrammar, type Category, type Palette } from "@/lib/art/grammar";
import { getTodayGenre } from "@/tokens/liquid";
import { foundation } from "@/tokens/foundation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const size = { width: 1200, height: 630 };

/**
 * GET /api/og/group/[id] — Generative OG image for a nut detail page.
 * next/og (Satori) 로 SVG+텍스트 합성.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: group } = await supabase
    .from("groups")
    .select("name, description, category")
    .eq("id", id)
    .maybeSingle();

  const name = group?.name || "nutunion";
  const description = (group?.description || "Protocol Collective").slice(0, 80);
  const catRaw = group?.category || "platform";
  const category = (["space", "culture", "platform", "vibe"].includes(catRaw) ? catRaw : "platform") as Category;

  const genre = getTodayGenre();
  const palette: Palette = {
    primary: genre.primary,
    secondary: genre.secondary,
    surface: genre.surface,
    ink: foundation.neutral[900],
  };
  const rng = rngFromSeed(`${id}::${genre.key}`);
  const svgChildren = drawGrammar(category, rng, 630, palette);

  // SVG → inline data URL (Satori 는 img src 에 SVG data URL 지원)
  const svgBody = svgChildren
    .map((c) => {
      const attrs = Object.entries(c.attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      return `<${c.tag} ${attrs}/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 630 630" width="630" height="630"><defs><filter id="blur-lg"><feGaussianBlur stdDeviation="50"/></filter></defs>${svgBody}</svg>`;
  const svgUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: palette.surface,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Left: generative visual */}
        <div
          style={{
            width: 520,
            height: 630,
            display: "flex",
            background: palette.surface,
            position: "relative",
          }}
        >
          <img src={svgUrl} width={520} height={630} style={{ objectFit: "cover" }} />
        </div>

        {/* Right: text */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 64px",
            color: foundation.neutral[900],
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.3em",
                color: palette.primary,
                marginBottom: 16,
                display: "flex",
              }}
            >
              너트 · {category}
            </div>
            <div
              style={{
                fontSize: 60,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                marginBottom: 24,
                display: "flex",
              }}
            >
              {name}
            </div>
            <div
              style={{
                fontSize: 24,
                lineHeight: 1.4,
                color: foundation.neutral[500],
                display: "flex",
              }}
            >
              {description}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 18,
              color: foundation.neutral[700],
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                background: palette.primary,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              ⊕
            </div>
            <span style={{ fontWeight: 700 }}>nutunion</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Today's Protocol: {genre.label}</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
