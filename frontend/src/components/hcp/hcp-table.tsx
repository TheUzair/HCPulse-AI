"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hcpApi } from "@/lib/api";
import { HCP } from "@/types";

export function HCPTable() {
  const [hcps, setHcps] = useState<HCP[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await hcpApi.list({ search: search || undefined, limit: 50 });
        setHcps(res.data || []);
        setTotal(res.total || 0);
      } catch (err) {
        console.error("Failed to load HCPs:", err);
      } finally {
        setLoading(false);
      }
    }
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Healthcare Professionals</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{total} HCPs in directory</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <Input
                placeholder="Search HCPs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : hcps.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No HCPs found. Seed sample data from the backend.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Specialty</th>
                  <th className="pb-3 font-medium">Organization</th>
                  <th className="pb-3 font-medium">Location</th>
                  <th className="pb-3 font-medium">Contact</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {hcps.map((hcp) => (
                  <tr key={hcp.id} className="text-sm">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {hcp.first_name[0]}
                          {hcp.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium">
                            Dr. {hcp.first_name} {hcp.last_name}
                          </p>
                          {hcp.npi_number && (
                            <p className="text-xs text-muted-foreground">NPI: {hcp.npi_number}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <Badge variant="secondary">{hcp.specialty || "N/A"}</Badge>
                    </td>
                    <td className="py-3 text-muted-foreground">{hcp.organization || "—"}</td>
                    <td className="py-3 text-muted-foreground">
                      {hcp.city && hcp.state ? `${hcp.city}, ${hcp.state}` : "—"}
                    </td>
                    <td className="py-3">
                      <div className="space-y-1">
                        {hcp.email && (
                          <p className="text-xs text-muted-foreground">{hcp.email}</p>
                        )}
                        {hcp.phone && (
                          <p className="text-xs text-muted-foreground">{hcp.phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <Link href={`/dashboard/hcp/${hcp.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
