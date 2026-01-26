import type { Metadata } from "next";
import { DM_Sans, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "Winefeed - B2B-plattformen för professionella vininköp",
  description: "Winefeed är en sluten marknadsplats som kopplar samman svenska restauranger, hotell och vinbarer med utvalda vinleverantörer i Europa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className={`${dmSans.variable} ${cormorant.variable} font-sans`}>{children}</body>
    </html>
  );
}
