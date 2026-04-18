"use client";

import { useSession } from "next-auth/react";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div>
        <h2 className="text-lg font-semibold">Welcome back</h2>
        <p className="text-sm text-muted-foreground">
          {session?.user?.name || "Field Representative"}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />
      </div>
    </header>
  );
}
