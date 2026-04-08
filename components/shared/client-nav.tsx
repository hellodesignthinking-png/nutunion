"use client";

import dynamic from "next/dynamic";

const Nav = dynamic(
  () => import("@/components/shared/nav").then((m) => ({ default: m.Nav })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[60px] bg-nu-paper/80 backdrop-blur-md border-b border-nu-ink/[0.08]" />
    ),
  }
);

export function ClientNav() {
  return <Nav />;
}
