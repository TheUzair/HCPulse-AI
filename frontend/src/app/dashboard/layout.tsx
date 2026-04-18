"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useDispatch } from "react-redux";
import { setUser } from "@/store/slices/authSlice";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const dispatch = useDispatch();

  useEffect(() => {
    if (session?.user) {
      dispatch(
        setUser({
          id: (session.user as any).id || "00000000-0000-4000-a000-000000000002",
          name: session.user.name || "Demo User",
          email: session.user.email || "demo@hcpulse.ai",
          image: session.user.image || undefined,
        })
      );
    } else {
      // Demo user fallback — matches backend seed UUID
      dispatch(
        setUser({
          id: "00000000-0000-4000-a000-000000000002",
          name: "John Smith",
          email: "rep@hcpulse.ai",
        })
      );
    }
  }, [session, dispatch]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
      </div>
    </div>
  );
}
