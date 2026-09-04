"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatNumber } from "@/lib/format";

export function BarkLiveViewCount({
  code,
  initialViews,
}: {
  code: string;
  initialViews: number;
}) {
  const doc = useQuery(api.barks.getByCode, { code });
  const views = doc?.views ?? initialViews;
  return <>{formatNumber(views)} views</>;
}
