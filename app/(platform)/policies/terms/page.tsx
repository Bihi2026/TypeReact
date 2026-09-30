import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Terms & Conditions",
};

const sections = [
  {
    title: "Using the public square",
    body: "TypeReact is a place to examine claims with sources. You may read, write reactions, ask questions, publish stories, and open accountability cases if you follow these terms and the posted policies.",
  },
  {
    title: "What you post",
    body: "You keep ownership of your reactions, questions, stories, cases, and files. You give TypeReact permission to store, display, and distribute that material on the platform, including in feeds, profiles, and notifications.",
  },
  {
    title: "Standards",
    body: "Discussions have to meet the Community Guidelines and Evidence Standards. Content can be lawful and still be removed when it breaks those rules.",
  },
  {
    title: "Enforcement",
    body: "Reports are reviewed under the Enforcement & Appeals policy. Outcomes can include a warning, removal, a restriction, or a ban. You can appeal a decision from the notice you receive.",
  },
  {
    title: "Ending an account",
    body: "You may stop using TypeReact at any time. We may suspend or close an account that keeps breaking these terms. Posts that are already part of a public discussion can remain so the record stays intact.",
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className="space-y-3">
        <Link
          href="/policies"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> All policies
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
          Terms & Conditions
        </h1>
        <p className="text-muted-foreground">
          The agreement for using TypeReact. Last updated September 30, 2026.
        </p>
      </div>

      <div className="grid gap-4">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-base">{section.title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                {section.body}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Related:{" "}
        <Link href="/policies/privacy" className="text-primary hover:underline">
          Privacy Policy
        </Link>
        {" · "}
        <Link
          href="/policies/community-guidelines"
          className="text-primary hover:underline"
        >
          Community Guidelines
        </Link>
        {" · "}
        <Link
          href="/policies/evidence-standards"
          className="text-primary hover:underline"
        >
          Evidence Standards
        </Link>
        {" · "}
        <Link
          href="/policies/enforcement"
          className="text-primary hover:underline"
        >
          Enforcement & Appeals
        </Link>
      </p>
    </div>
  );
}
