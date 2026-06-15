import { Inter } from 'next/font/google';
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title:       "BarakaFlow — Inventory Management for Rwanda",
  description: "Manage your furniture shop inventory, orders, and suppliers. Built for businesses in Rwanda.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en"
      className={`${inter.variable} h-full antialiased`}
       suppressHydrationWarning>
      
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
