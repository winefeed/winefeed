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
        url: "/winefeed-logo-light.png",
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
    images: ["/winefeed-logo-light.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: 'gDm6S3HT2KBRsOA3A3yK1lJF7PFywN6cVt9jcsDYZC4',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Winefeed',
  url: 'https://winefeed.se',
  logo: 'https://winefeed.se/winefeed-logo-light.png',
  description:
    'B2B-plattformen som kopplar samman restauranger med vinleverantörer.',
  email: 'hej@winefeed.se',
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'hej@winefeed.se',
    contactType: 'customer service',
  },
};

const webSiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Winefeed',
  url: 'https://winefeed.se',
  description: 'Sluten marknadsplats för restauranger och vinleverantörer.',
  publisher: { '@type': 'Organization', name: 'Winefeed' },
  inLanguage: 'sv',
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(webSiteJsonLd),
          }}
        />
      </body>
    </html>
  );
}
