import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, Space_Mono, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-head",
  subsets: ["latin"],
  weight: ["200", "400", "500", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "nutunion — protocol collective",
  description:
    "공간, 문화, 플랫폼, 바이브를 잇는 protocol collective. Scene을 설계하는 커뮤니티.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      className={`${bricolage.variable} ${dmSans.variable} ${spaceMono.variable} ${fraunces.variable}`}
    >
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
