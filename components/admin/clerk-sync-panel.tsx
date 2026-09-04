"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { AdminGate } from "@/components/admin/admin-gate";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";

export function ClerkSyncPanel() {
  const { isAuthenticated } = useConvexAuth();
  const store = useQuery(
    api.clerk.listSynced,
    isAuthenticated ? {} : "skip"
  );

  return (
    <AdminGate loading="Loading sync…" allowed={store}>
      {store ? (
        <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Synced users" value={store.users.length} />
        <Stat label="Organizations" value={store.organizations.length} />
        <Stat label="Memberships" value={store.memberships.length} />
        <Stat label="Subscriptions" value={store.subscriptions.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
          <CardDescription>
            Written by the Clerk webhook into Convex.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {store.users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users yet. Point Clerk at{" "}
              <code className="rounded bg-muted px-1">
                /clerk-webhook
              </code>{" "}
              on your Convex site URL.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {store.users.map((u) => (
                  <TableRow key={u.clerkId}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organizations</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {store.organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations synced.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="hidden md:table-cell">Clerk id</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {store.organizations.map((o) => (
                  <TableRow key={o.clerkId}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell>{o.slug}</TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">
                      {o.clerkId}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {store.events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {store.events
              .slice()
              .reverse()
              .map((e, i) => (
                <div
                  key={`${e.clerkId}-${e.at}-${i}`}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <Badge variant="secondary">{e.type}</Badge>
                </div>
              ))}
          </CardContent>
        </Card>
        )}
      </div>
      ) : null}
    </AdminGate>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-1 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}
