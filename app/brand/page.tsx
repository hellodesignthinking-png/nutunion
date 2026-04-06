import type { Metadata } from "next";
import dynamic from "next/dynamic";

const BrandPage = dynamic(() => import("@/components/brand/brand-page-client").then(m => ({ default: m.BrandPageClient })));

export const metadata: Metadata = {
  title: "Brand Identity — nutunion",
  description: "너트유니온 Nut-Cell 마스터 디자인 시스템. 카테고리별 가변 로고, 컬러 팔레트, 폰트 시스템을 탐색하세요.",
};

export default function BrandRoute() {
  return <BrandPage />;
}
