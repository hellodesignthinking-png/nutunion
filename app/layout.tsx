import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { GenreThemeProvider } from "@/components/brand/genre-theme-context";
import { GlobalSearch } from "@/components/shared/global-search";
import { PwaBootstrap } from "@/components/shared/pwa-bootstrap";
import { KakaoSdkLoader } from "@/components/shared/kakao-sdk-loader";
import { SidebarProvider } from "@/components/shared/sidebar-provider";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0D0D0D",
};

export const metadata: Metadata = {
  title: "너트유니온 — 너(You)와 너트(Nut)의 연합",
  description: "너트(Nut) + 볼트(Bolt) = 변화를 만드는 힘. 시티체인저들의 자율적 연합체.",
  manifest: "/manifest.json",
  // Google OAuth 검수: 개인정보처리방침 URL 명시
  metadataBase: new URL("https://nutunion.co.kr"),
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "너트유니온",
  },
  openGraph: {
    title: "너트유니온 — 너(You)와 너트(Nut)의 연합",
    description: "너트(Nut) + 볼트(Bolt) = 변화를 만드는 힘. 시티체인저들의 자율적 연합체.",
    siteName: "너트유니온",
    type: "website",
    url: "https://nutunion.co.kr",
    images: [{ url: "/hero-risograph.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "너트유니온 — 너(You)와 너트(Nut)의 연합",
    description: "너트(Nut) + 볼트(Bolt) = 변화를 만드는 힘. 시티체인저들의 자율적 연합체.",
    images: ["/hero-risograph.png"],
  },
  alternates: {
    canonical: "https://nutunion.co.kr",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">
        <GenreThemeProvider>
          <SidebarProvider>
            {children}
          </SidebarProvider>
        </GenreThemeProvider>
        <GlobalSearch />
        <Toaster position="bottom-right" />
        <PwaBootstrap />
        <KakaoSdkLoader />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
