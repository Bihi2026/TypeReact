"use client";

import type { ReactNode } from "react";
import { Shield } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export function AdminGate({
  loading,
  allowed,
  children,
}: {
  loading: string;
  allowed: unknown;
  children: ReactNode;
}) {
  if (allowed === undefined) {
    return (
      <div className="space-y-3" role="status" aria-label={loading}>
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }
  if (allowed === null) {
    return (
      <EmptyState
        icon={Shield}
        title="Admins only"
        description="This view is limited to site admins. Ask to be added to ADMIN_CLERK_IDS, or use an organization admin role."
      />
    );
  }
  return children;
}
