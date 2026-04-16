import type { Metadata, Viewport } from "next";
import { Outfit, Space_Grotesk, Space_Mono, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { GenreThemeProvider } from "@/components/brand/genre-theme-context";
import { GlobalSearch } from "@/components/shared/global-search";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-head",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

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
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${outfit.variable} ${spaceGrotesk.variable} ${spaceMono.variable} ${playfair.variable}`}>
      <body className="min-h-screen antialiased">
        <GenreThemeProvider>
          {children}
        </GenreThemeProvider>
        <GlobalSearch />
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
