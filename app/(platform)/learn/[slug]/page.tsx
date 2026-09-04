import type { Metadata } from "next";
import { Suspense } from "react";
import {
  LearningDetailSkeleton,
  LearningResourceDetail,
} from "@/components/learning/learning-hub";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: slug.replace(/-/g, " "),
  };
}

export default async function LearnResourcePage({ params }: Props) {
  const { slug } = await params;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
      <Suspense fallback={<LearningDetailSkeleton />}>
        <LearningResourceDetail slug={slug} />
      </Suspense>
    </div>
  );
}
