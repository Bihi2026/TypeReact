import { caseCategoryMeta } from "@/lib/meta";
import { isCaseCategory } from "@/lib/topics";
import type { Bark, CaseCategory } from "@/lib/types";

export type HomeDiscoveryTopic = {
  slug: string;
  label: string;
  hint: string;
  keywords: string[];
  iconBg: string;
  iconColor: string;
  /** Navigate here instead of filtering when that destination is clearer. */
  href?: string;
};

export const HOME_DISCOVERY_TOPICS: HomeDiscoveryTopic[] = [
  {
    slug: "news",
    label: "News",
    hint: "What's happening now",
    keywords: ["news", "headline", "breaking", "report", "press", "media"],
    iconBg: "bg-sky-100 dark:bg-sky-950/70",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  // {
  //   slug: "ask",
  //   label: "Ask a Question",
  //   hint: "Start a discussion",
  //   keywords: ["question", "ask", "why", "how", "explain"],
  //   iconBg: "bg-cyan-100 dark:bg-cyan-950/70",
  //   iconColor: "text-cyan-600 dark:text-cyan-400",
  //   href: "/explore",
  // },
  {
    slug: "problems",
    label: "Problems",
    hint: "Issues people face",
    keywords: ["problem", "issue", "crisis", "fail", "harm", "abuse"],
    iconBg: "bg-rose-100 dark:bg-rose-950/70",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  {
    slug: "solutions",
    label: "Solutions",
    hint: "What can work",
    keywords: ["solution", "fix", "reform", "proposal", "plan", "policy"],
    iconBg: "bg-emerald-100 dark:bg-emerald-950/70",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    slug: "ideas",
    label: "Ideas",
    hint: "New ways forward",
    keywords: ["idea", "vision", "imagine", "innovation", "story"],
    iconBg: "bg-violet-100 dark:bg-violet-950/70",
    iconColor: "text-violet-600 dark:text-violet-400",
    href: "/stories/ideas",
  },
  {
    slug: "reports",
    label: "Reports",
    hint: "Documented findings",
    keywords: ["report", "investigation", "audit", "findings", "evidence"],
    iconBg: "bg-orange-100 dark:bg-orange-950/70",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  {
    slug: "economy",
    label: "Economy",
    hint: "Money and markets",
    keywords: ["economy", "economic", "inflation", "gdp", "market", "trade"],
    iconBg: "bg-amber-100 dark:bg-amber-950/70",
    iconColor: "text-amber-700 dark:text-amber-400",
  },
  {
    slug: "jobs",
    label: "Jobs",
    hint: "Work and wages",
    keywords: ["job", "jobs", "employment", "wage", "unemployment", "labor", "labour"],
    iconBg: "bg-indigo-100 dark:bg-indigo-950/70",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    slug: "business",
    label: "Business",
    hint: "Companies and commerce",
    keywords: ["business", "company", "corporate", "startup", "industry"],
    iconBg: "bg-slate-200 dark:bg-slate-800",
    iconColor: "text-slate-700 dark:text-slate-300",
  },
  {
    slug: "government",
    label: "Government",
    hint: "Public power",
    keywords: ["government", "minister", "parliament", "election", "official", "state"],
    iconBg: "bg-blue-100 dark:bg-blue-950/70",
    iconColor: "text-blue-700 dark:text-blue-400",
  },
  {
    slug: "law-and-justice",
    label: "Law and Justice",
    hint: "Courts and rights",
    keywords: ["law", "legal", "court", "justice", "rights", "judge", "crime"],
    iconBg: "bg-fuchsia-100 dark:bg-fuchsia-950/70",
    iconColor: "text-fuchsia-600 dark:text-fuchsia-400",
  },
  {
    slug: "health",
    label: "Health",
    hint: "Care and wellbeing",
    keywords: ["health", "hospital", "medical", "doctor", "vaccine", "mental"],
    iconBg: "bg-pink-100 dark:bg-pink-950/70",
    iconColor: "text-pink-600 dark:text-pink-400",
  },
  {
    slug: "education",
    label: "Education",
    hint: "Schools and learning",
    keywords: ["education", "school", "student", "university", "teacher", "learn"],
    iconBg: "bg-teal-100 dark:bg-teal-950/70",
    iconColor: "text-teal-700 dark:text-teal-400",
  },
  {
    slug: "housing",
    label: "Housing",
    hint: "Homes and rent",
    keywords: ["housing", "rent", "home", "homeless", "mortgage", "landlord"],
    iconBg: "bg-yellow-100 dark:bg-yellow-950/60",
    iconColor: "text-yellow-700 dark:text-yellow-400",
  },
  {
    slug: "infrastructure",
    label: "Infrastructure",
    hint: "Roads and utilities",
    keywords: ["infrastructure", "road", "transit", "bridge", "power", "water", "internet"],
    iconBg: "bg-stone-200 dark:bg-stone-800",
    iconColor: "text-stone-700 dark:text-stone-300",
  },
  {
    slug: "environment",
    label: "Environment",
    hint: "Climate and land",
    keywords: ["environment", "climate", "pollution", "carbon", "wildlife", "energy"],
    iconBg: "bg-lime-100 dark:bg-lime-950/70",
    iconColor: "text-lime-700 dark:text-lime-400",
  },
  {
    slug: "people-life",
    label: "People / Life",
    hint: "Everyday civic life",
    keywords: ["people", "community", "family", "life", "culture", "citizen"],
    iconBg: "bg-red-100 dark:bg-red-950/70",
    iconColor: "text-red-600 dark:text-red-400",
  },
];

export const HOME_TOPIC_PARAM = "topic";

export function getDiscoveryTopic(
  slug: string
): HomeDiscoveryTopic | undefined {
  return HOME_DISCOVERY_TOPICS.find((topic) => topic.slug === slug);
}

function haystackForBark(bark: Bark): string {
  return [
    bark.title,
    bark.excerpt,
    bark.sourceTitle ?? "",
    ...bark.topics,
  ]
    .join(" ")
    .toLowerCase();
}

export function barkMatchesDiscoveryTopic(
  bark: Bark,
  topic: HomeDiscoveryTopic
): boolean {
  const haystack = haystackForBark(bark);
  return topic.keywords.some((keyword) => haystack.includes(keyword));
}

export function barkMatchesHomeTopic(bark: Bark, slug: string): boolean {
  if (!slug) return true;
  const discovery = getDiscoveryTopic(slug);
  if (discovery) return barkMatchesDiscoveryTopic(bark, discovery);
  if (isCaseCategory(slug)) return bark.topics.includes(slug);
  return true;
}

export function homeTopicChipLabel(bark: Bark): string {
  const discovery = HOME_DISCOVERY_TOPICS.find((topic) =>
    barkMatchesDiscoveryTopic(bark, topic)
  );
  if (discovery) return discovery.label;
  const first = bark.topics.find((topic): topic is CaseCategory =>
    isCaseCategory(topic)
  );
  if (first) return caseCategoryMeta[first].label;
  return "Discussion";
}

export type HomeTopicFilterOption = {
  value: string;
  label: string;
  group: "discovery" | "cases";
};

export function homeDiscoveryCounts(barks: Bark[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const topic of HOME_DISCOVERY_TOPICS) {
    counts[topic.slug] = barks.filter((bark) =>
      barkMatchesDiscoveryTopic(bark, topic)
    ).length;
  }
  return counts;
}

export function homeTopicFilterOptions(): HomeTopicFilterOption[] {
  const discovery = HOME_DISCOVERY_TOPICS.map((topic) => ({
    value: topic.slug,
    label: topic.label,
    group: "discovery" as const,
  }));
  const cases = (Object.keys(caseCategoryMeta) as CaseCategory[]).map(
    (slug) => ({
      value: slug,
      label: caseCategoryMeta[slug].label,
      group: "cases" as const,
    })
  );
  return [...discovery, ...cases];
}
