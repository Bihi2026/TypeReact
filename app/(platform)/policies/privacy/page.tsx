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
  title: "Privacy Policy",
};

const sections = [
  {
    title: "Account",
    body: "Signing in is handled by Clerk. TypeReact receives the name, email address, and profile image on your account so we can show who wrote a reaction, question, story, or case.",
  },
  {
    title: "Profile and country",
    body: "You can add a bio, website, and country in Settings. Country is used to label discussions and to scope the home and Explore feeds. Visibility choices in Settings control whether your profile and country are shown publicly.",
  },
  {
    title: "What you post",
    body: "Reactions, questions, answers, stories, accountability cases, and the files you attach are stored so other people can read them. Direct messages stay between the people in that conversation.",
  },
  {
    title: "Notification email",
    body: "If you turn email notifications on, we send those messages to the address on your account. You can turn categories off in notification settings.",
  },
  {
    title: "What stays in Settings",
    body: "Search visibility, who can message you, and whether your country is shown are account preferences. They are not published as posts. Change them any time from Settings.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className="space-y-3">
        <Link
          href="/policies"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> All policies
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-muted-foreground">
          What TypeReact keeps about you, what other people can see, and where
          to change it. Last updated September 30, 2026.
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
        <Link href="/policies/terms" className="text-primary hover:underline">
          Terms & Conditions
        </Link>
        {" · "}
        <Link
          href="/policies/community-guidelines"
          className="text-primary hover:underline"
        >
          Community Guidelines
        </Link>
        {" · "}
        <Link href="/settings/privacy" className="text-primary hover:underline">
          Privacy settings
        </Link>
      </p>
    </div>
  );
}
