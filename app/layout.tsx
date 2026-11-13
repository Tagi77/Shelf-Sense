import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./enhancements.css";
import "./fresh-kitchen.css";
import ThemeProvider from "@/components/ui/theme-provider";
import MotionProvider from "@/components/ui/motion-provider";
export const metadata: Metadata = {
  title: "Shelf Sense — ваша кухня под контролем",
  description:
    "Продукты под рукой. Сроки под контролем. Your kitchen, thoughtfully organised.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#F6F5F1",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <MotionProvider>{children}</MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
