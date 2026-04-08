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
  title: "nutunion — protocol collective",
  description: "공간, 문화, 플랫폼, 바이브를 잇는 protocol collective. Scene을 설계하는 커뮤니티.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "nutunion",
  },
  openGraph: {
    title: "nutunion — protocol collective",
    description: "AI가 보증하고 공동체가 운영하는 자율형 커리어 생태계",
    siteName: "nutunion",
    type: "website",
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
