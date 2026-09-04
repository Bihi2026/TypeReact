"use client";

import { use } from "react";
import { CircleDetail } from "@/components/circles/circle-detail";
import type { Id } from "@/convex/_generated/dataModel";

export default function CirclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <CircleDetail circleId={id as Id<"researchCircles">} />;
}
