import type { Metadata } from "next";
import { Suspense } from "react";
import {
  ApplyWizard,
  ApplyWizardSkeleton,
} from "@/components/creator/apply-wizard";

export const metadata: Metadata = {
  title: "Become a Creator",
};

export default function CreatorApplyPage() {
  return (
    <Suspense fallback={<ApplyWizardSkeleton />}>
      <ApplyWizard />
    </Suspense>
  );
}
