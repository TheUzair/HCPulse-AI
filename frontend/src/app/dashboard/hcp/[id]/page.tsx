"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hcpApi, interactionApi } from "@/lib/api";
import { HCP, Interaction } from "@/types";

export default function HCPDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [hcp, setHcp] = useState<HCP | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [hcpData, ixData] = await Promise.all([
          hcpApi.get(params.id as string),
          interactionApi.list({ hcp_id: params.id as string, limit: 20 }),
        ]);
        setHcp(hcpData);
        setInteractions(ixData.data || []);
      } catch (err) {
        console.error("Failed to load HCP:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!hcp) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">HCP not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    in_person: "In Person",
    phone: "Phone",
    email: "Email",
    video: "Video",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dr. {hcp.first_name} {hcp.last_name}
          </h1>
          <p className="text-sm text-muted-foreground">{hcp.specialty || "General Practice"}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {hcp.email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{hcp.email}</span>
              </div>
            )}
            {hcp.phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span>{hcp.phone}</span>
              </div>
            )}
            {hcp.organization && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Organization</span>
                <span>{hcp.organization}</span>
              </div>
            )}
            {hcp.city && hcp.state && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span>{hcp.city}, {hcp.state}</span>
              </div>
            )}
            {hcp.npi_number && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">NPI</span>
                <span>{hcp.npi_number}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Interaction Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Interactions</span>
              <span className="font-medium">{interactions.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Interaction</span>
              <span>{interactions[0]?.date || "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interaction History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Interaction History</CardTitle>
            <Link href="/dashboard/interactions/new">
              <Button size="sm">Log Interaction</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {interactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No interactions recorded with this HCP yet.
            </p>
          ) : (
            <div className="space-y-3">
              {interactions.map((ix) => (
                <div key={ix.id} className="flex items-start justify-between rounded-lg border p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {ix.summary || ix.notes?.substring(0, 80) || "Interaction"}
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-[11px]">
                        {typeLabels[ix.interaction_type] || ix.interaction_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{ix.date}</span>
                    </div>
                  </div>
                  {ix.sentiment && (
                    <Badge
                      variant={
                        ix.sentiment === "positive" ? "default" :
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
