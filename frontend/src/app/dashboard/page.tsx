"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hcpApi, interactionApi } from "@/lib/api";

interface Stats {
  totalHCPs: number;
  totalInteractions: number;
  recentInteractions: any[];
}

export default function DashboardPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [stats, setStats] = useState<Stats>({
    totalHCPs: 0,
    totalInteractions: 0,
    recentInteractions: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    async function loadStats() {
      try {
        const [hcpRes, ixRes] = await Promise.all([
          hcpApi.list({ limit: 1 }).catch(() => ({ total: 0 })),
          interactionApi.list({ limit: 5, user_id: user!.id }).catch(() => ({ total: 0, data: [] })),
        ]);
        setStats({
          totalHCPs: hcpRes.total || 0,
          totalInteractions: ixRes.total || 0,
          recentInteractions: ixRes.data || [],
        });
      } catch {
        // Backend might not be running
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [user?.id]);

  const statCards = [
    {
      title: "Total HCPs",
      value: stats.totalHCPs,
      icon: (
        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      color: "bg-blue-50",
    },
    {
      title: "Total Interactions",
      value: stats.totalInteractions,
      icon: (
        <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
      ),
      color: "bg-emerald-50",
    },
    {
      title: "This Week",
      value: stats.recentInteractions.length,
      icon: (
        <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
      color: "bg-amber-50",
    },
    {
      title: "AI Assisted",
      value: "Active",
      icon: (
        <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      ),
      color: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold">{loading ? "—" : stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
            <h3 className="text-lg font-semibold">Log New Interaction</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the AI chat or form to log your latest HCP interaction
            </p>
            <Link href="/dashboard/interactions/new">
              <Button className="mt-4">
                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Interaction
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 p-6">
            <h3 className="text-lg font-semibold">HCP Directory</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse and manage your healthcare professional contacts
            </p>
            <Link href="/dashboard/hcp">
              <Button variant="outline" className="mt-4">
                View Directory
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Recent Interactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Interactions</CardTitle>
            <Link href="/dashboard/interactions">
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : stats.recentInteractions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No interactions yet. Start by logging your first interaction!
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentInteractions.map((ix: any) => (
                <div
                  key={ix.id}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                      <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{ix.summary || ix.notes?.substring(0, 60) || "Interaction"}</p>
                      <p className="text-xs text-muted-foreground">{ix.date} · {ix.interaction_type?.replace("_", " ")}</p>
                    </div>
                  </div>
                  {ix.sentiment && (
                    <Badge
                      variant={
                        ix.sentiment === "positive" ? "success" :
                          ix.sentiment === "negative" ? "destructive" : "secondary"
                      }
                    >
                      {ix.sentiment}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
