import type { Metadata } from "next";
import { Syne, Syne_Mono, Geist, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const syneMono = Syne_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-impact",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sakai — Voice-First Commute Assistant",
  description:
    "The fastest way to navigate Metro Manila. Jeepney-first, multimodal, and voice-powered.",
  icons: { icon: "/sakai-icon.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${syne.variable} ${syneMono.variable} ${geist.variable} ${spaceGrotesk.variable}`}>
        <Script id="theme-reset" strategy="beforeInteractive">
          {`try {
            localStorage.removeItem("sakai-theme");
            document.documentElement.classList.add("dark");
          } catch {}
          `}
        </Script>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="sakai-theme"
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
