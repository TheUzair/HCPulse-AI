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
          id: (session.user as any).id || "demo-user-id",
          name: session.user.name || "Demo User",
          email: session.user.email || "demo@aivoa.com",
          image: session.user.image || undefined,
        })
      );
    } else {
      // Demo user fallback
      dispatch(
        setUser({
          id: "demo-user-id",
          name: "John Smith",
          email: "rep@aivoa.com",
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
