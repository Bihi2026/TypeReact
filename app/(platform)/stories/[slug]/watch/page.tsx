import type { Metadata } from "next";
import { Suspense } from "react";
import { StoryWatchRoute } from "@/components/stories/story-watch-route";
import { RouteLoading } from "@/components/route-loading";

export const metadata: Metadata = {
  title: "Watch story",
};

export default function StoryWatchPage() {
  return (
    <Suspense fallback={<RouteLoading variant="detail" />}>
      <StoryWatchRoute />
    </Suspense>
  );
}
