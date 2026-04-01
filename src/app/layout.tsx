import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "The Back Bar — Myatt's Fields",
  description: "Internal operations hub for Myatt's Fields Cocktails",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "The Back Bar",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full`}>
      <body className="min-h-full" style={{ background: "#080808", color: "#f0f0f0" }}>
        {children}
      </body>
    </html>
  );
}
