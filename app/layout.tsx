import type { Metadata } from "next";
import { DM_Sans, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

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
  title: {
    default: "Winefeed - B2B-plattformen för professionella vininköp",
    template: "%s | Winefeed",
  },
  description: "Winefeed är en sluten marknadsplats som kopplar samman svenska restauranger, hotell och vinbarer med utvalda vinleverantörer i Europa.",
  keywords: ["vin", "B2B", "restaurang", "vininköp", "vinleverantör", "import", "horeca"],
  authors: [{ name: "Winefeed" }],
  creator: "Winefeed",
  metadataBase: new URL("https://winefeed.se"),
  openGraph: {
    type: "website",
    locale: "sv_SE",
    url: "https://winefeed.se",
    siteName: "Winefeed",
    title: "Winefeed - B2B-plattformen för professionella vininköp",
    description: "Sluten marknadsplats för restauranger och vinleverantörer. Från offert till leverans utan friktion.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Winefeed - B2B vinhandel",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Winefeed - B2B-plattformen för professionella vininköp",
    description: "Sluten marknadsplats för restauranger och vinleverantörer.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className={`${dmSans.variable} ${cormorant.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
