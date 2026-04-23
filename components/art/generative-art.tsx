import { rngFromSeed } from "@/lib/art/prng";
import { drawGrammar, type Category, type Palette, type SvgChild } from "@/lib/art/grammar";
import { getTodayGenre, type Genre } from "@/tokens/liquid";
import { foundation } from "@/tokens/foundation";

/**
 * GenerativeArt — 카테고리·seed·오늘의 Liquid 장르 기반 결정적 SVG.
 *
 * 사용:
 *   <GenerativeArt seed={group.id} category="culture" variant="thumb" />
 *
 * variant 별 권장 size:
 *   thumb — 120~160 (카드 썸네일)
 *   card  — 240~320 (카드 메인 비주얼)
 *   hero  — 480~720 (랜딩 Hero)
 *   og    — 1200 (Open Graph, 텍스트 포함)
 */

export type Variant = "thumb" | "card" | "hero" | "og";

interface Props {
  seed: string;
  category: Category;
  size?: number;
  variant?: Variant;
  genre?: Genre;                // 주입 가능 (테스트/미리보기)
  className?: string;
  title?: string;                // 접근성
}

const VARIANT_SIZE: Record<Variant, number> = {
  thumb: 160,
  card: 280,
  hero: 640,
  og: 1200,
};

export function GenerativeArt({
  seed,
  category,
  size,
  variant = "card",
  genre,
  className,
  title,
}: Props) {
  const actualSize = size ?? VARIANT_SIZE[variant];
  const g = genre ?? getTodayGenre();

  // seed 에 오늘 장르 섞음 — 같은 너트지만 장르에 따라 팔레트 변화
  const rng = rngFromSeed(`${seed}::${g.key}`);

  const palette: Palette = {
    primary: g.primary,
    secondary: g.secondary,
    surface: g.surface,
    ink: foundation.neutral[900],
  };

  const children = drawGrammar(category, rng, actualSize, palette);

  return (
    <svg
      viewBox={`0 0 ${actualSize} ${actualSize}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={title ?? `${category} art`}
    >
      <defs>
        <filter id="blur-lg">
          <feGaussianBlur stdDeviation={actualSize * 0.08} />
        </filter>
      </defs>
      {children.map((c, i) => renderNode(c, i))}
    </svg>
  );
}

function renderNode(node: SvgChild, key: number): React.ReactElement {
  // Convert kebab-case attributes to camelCase for React SVG
  const reactAttrs: Record<string, any> = {};
  for (const [k, v] of Object.entries(node.attrs)) {
    if (k === "stroke-width") reactAttrs.strokeWidth = v;
    else if (k === "stroke-dasharray") reactAttrs.strokeDasharray = v;
    else if (k === "stroke-linecap") reactAttrs.strokeLinecap = v;
    else reactAttrs[k] = v;
  }

  const Tag = node.tag as any;
  return (
    <Tag key={key} {...reactAttrs}>
      {node.children?.map((c, i) => renderNode(c, i))}
    </Tag>
  );
}

/** 랜딩 등에서 비로그인 시에도 사용되는 기본 Scene 엠블럼 */
export function CategoryEmblem({ category, size = 120, seed, className }: { category: Category; size?: number; seed?: string; className?: string }) {
  return (
    <GenerativeArt
      seed={seed ?? `emblem-${category}`}
      category={category}
      size={size}
      variant="thumb"
      className={className}
    />
  );
}
