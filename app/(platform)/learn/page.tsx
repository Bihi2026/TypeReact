import type { Metadata } from "next";
import { Suspense } from "react";
import {
  LearningHub,
  LearningHubSkeleton,
} from "@/components/learning/learning-hub";

export const metadata: Metadata = {
  title: "Learning Center",
  description:
    "Watch tutorials, read guides, and download resources for evidence-based discussion on TypeReact.",
};

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <Suspense fallback={<LearningHubSkeleton />}>
        <LearningHub />
      </Suspense>
    </div>
  );
}
