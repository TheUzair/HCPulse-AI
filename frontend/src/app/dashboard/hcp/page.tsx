"use client";

import { HCPTable } from "@/components/hcp/hcp-table";

export default function HCPPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">HCP Directory</h1>
        <p className="text-sm text-muted-foreground">
          Manage your Healthcare Professional contacts
        </p>
      </div>
      <HCPTable />
    </div>
  );
}
