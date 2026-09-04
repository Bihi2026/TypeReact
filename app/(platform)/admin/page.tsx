import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
          <div className="h-10 w-64 animate-pulse rounded-md bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      }
    >
      <AdminDashboard />
    </Suspense>
  );
}
