import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Winefeed - AI-driven vinrekommendationer för restauranger",
  description: "Få smarta vinförslag för din restaurang på 30 sekunder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
