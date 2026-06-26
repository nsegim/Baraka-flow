import { Montserrat } from 'next/font/google';
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-Montserrat', // 👈 Matches your CSS variable exactly
  weight: ['400', '500', '700'],  // Choose the weights you need
});

export const metadata: Metadata = {
  title:       "BarakaFlow — Inventory Management for Rwanda",
  description: "Manage your furniture shop inventory, orders, and suppliers. Built for businesses in Rwanda.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale   = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}
      className={`${montserrat.variable} h-full antialiased`}
      suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
