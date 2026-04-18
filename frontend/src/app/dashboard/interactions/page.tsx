"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { interactionApi } from "@/lib/api";
import { Interaction } from "@/types";

export default function InteractionsPage() {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await interactionApi.list({ limit: 50 });
        setInteractions(res.data || []);
        setTotal(res.total || 0);
      } catch (err) {
        console.error("Failed to load interactions:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const typeLabels: Record<string, string> = {
    in_person: "In Person",
    phone: "Phone",
    email: "Email",
    video: "Video",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interactions</h1>
          <p className="text-sm text-muted-foreground">{total} interactions logged</p>
        </div>
        <Link href="/dashboard/interactions/new">
          <Button>
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Interaction
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : interactions.length === 0 ? (
            <div className="py-16 text-center">
              <svg className="mx-auto h-12 w-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
              <p className="mt-4 text-sm text-muted-foreground">No interactions logged yet</p>
              <Link href="/dashboard/interactions/new">
                <Button className="mt-4" variant="outline">
                  Log your first interaction
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {interactions.map((ix) => (
                <div
                  key={ix.id}
                  className="flex items-start justify-between p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {ix.summary || ix.notes?.substring(0, 80) || "Interaction"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-[11px]">
                          {typeLabels[ix.interaction_type] || ix.interaction_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{ix.date}</span>
                        {ix.products_discussed?.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            · {ix.products_discussed.join(", ")}
                          </span>
                        )}
                      </div>
                      {ix.follow_up_actions?.length > 0 && (
                        <div className="flex gap-1">
                          {ix.follow_up_actions.map((a, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">
                              {a}
                            </Badge>
                          ))}
                        </div>
                      )}
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
