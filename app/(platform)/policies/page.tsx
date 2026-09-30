import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  FileCheck2,
  Gavel,
  HeartHandshake,
  Lock,
  ScrollText,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Policies",
};

const policies = [
  {
    href: "/policies/community-guidelines",
    icon: HeartHandshake,
    title: "Community Guidelines",
    description:
      "What conduct is prohibited on TypeReact — including racism, discrimination, harassment, and fabricated evidence — even when it isn't illegal.",
  },
  {
    href: "/policies/evidence-standards",
    icon: FileCheck2,
    title: "Evidence Standards",
    description:
      "What counts as valid evidence, how verification levels work, and the sourcing bar for reactions and accountability cases.",
  },
  {
    href: "/policies/enforcement",
    icon: Gavel,
    title: "Enforcement & Appeals",
    description:
      "How reports are triaged, the ladder of consequences from warnings to bans, and how to appeal a decision.",
  },
  {
    href: "/policies/privacy",
    icon: Lock,
    title: "Privacy Policy",
    description:
      "What TypeReact keeps about your account, posts, and files, and what other people can see.",
  },
  {
    href: "/policies/terms",
    icon: ScrollText,
    title: "Terms & Conditions",
    description:
      "The agreement for using the public square, including what you post and how accounts can end.",
  },
];

export default function PoliciesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Policies</h1>
        <p className="text-muted-foreground">
          TypeReact is built on evidence and good faith. These policies define
          the standards every discussion, reaction, and accountability case must
          meet — and what happens when they don&apos;t.
        </p>
      </div>
      <div className="grid gap-4">
        {policies.map((p) => {
          const Icon = p.icon;
          return (
            <Link key={p.href} href={p.href} className="group">
              <Card className="transition-colors group-hover:border-primary/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="size-5 text-primary" aria-hidden />
                      </span>
                      <div className="space-y-1">
                        <CardTitle>{p.title}</CardTitle>
                        <CardDescription>{p.description}</CardDescription>
                      </div>
                    </div>
                    <ArrowRight
                      className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
      <Card className="bg-muted/40">
        <CardContent className="space-y-1.5 text-sm">
          <p className="font-medium">A note on legality</p>
          <p className="text-muted-foreground">
            These policies are stricter than the law. Content can be legal and
            still removed — racism, discrimination, and harassment violate our
            community standards regardless of whether they violate any statute.
            Reporting such content is always appropriate.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
