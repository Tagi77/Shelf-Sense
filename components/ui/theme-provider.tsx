"use client";
import { ThemeProvider as Provider } from "next-themes";
export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Provider
      attribute="data-theme"
      storageKey="shelf-theme"
      defaultTheme="system"
      enableSystem
    >
      {children}
    </Provider>
  );
}
