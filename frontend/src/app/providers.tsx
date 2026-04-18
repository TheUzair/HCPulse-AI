"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ReduxProvider } from "@/store/provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <ReduxProvider>{children}</ReduxProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
