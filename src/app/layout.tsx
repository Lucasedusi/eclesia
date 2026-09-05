import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import { APP_CONFIG } from "@/constants/app";
import { AppProviders } from "@/providers/app-providers";
import { WebVitals } from "@/components/observability/web-vitals";
import "./globals.css";

const appFont = Nunito_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app",
});

export const metadata: Metadata = {
  title: APP_CONFIG.name,
  description: APP_CONFIG.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={appFont.variable} suppressHydrationWarning>
        <WebVitals />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
