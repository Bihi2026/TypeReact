import {
  BookOpen,
  FileDown,
  FileText,
  GraduationCap,
  Play,
  Scale,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { LearningCategory, LearningResourceType } from "@/lib/types";

export const learningCategories: {
  id: LearningCategory;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    description: "New to TypeReact? Start here.",
    icon: Sparkles,
  },
  {
    id: "evidence",
    label: "Evidence",
    description: "Sourcing, verification, and standards.",
    icon: FileText,
  },
  {
    id: "reactions",
    label: "Reactions",
    description: "Write and publish evidence-based responses.",
    icon: BookOpen,
  },
  {
    id: "cases",
    label: "Cases",
    description: "Accountability cases and sustained scrutiny.",
    icon: Scale,
  },
  {
    id: "creators",
    label: "Creators",
    description: "Profiles, verification, and official responses.",
    icon: Users,
  },
  {
    id: "platform",
    label: "Platform",
    description: "Explore, circles, and platform features.",
    icon: GraduationCap,
  },
];

export const learningTypeMeta: Record<
  LearningResourceType,
  { label: string; icon: LucideIcon }
> = {
  video: { label: "Video", icon: Play },
  article: { label: "Article", icon: FileText },
  download: { label: "Download", icon: FileDown },
};

export function learningCategoryLabel(category: LearningCategory): string {
  return learningCategories.find((c) => c.id === category)?.label ?? category;
}

export function slugifyLearningTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "resource"
  );
}
