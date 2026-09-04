import Link from "next/link";
import { BrandLogo } from "@/components/shell/brand-logo";

const columns = [
  {
    heading: "Platform",
    links: [
      { label: "Explore", href: "/explore" },
      { label: "Reactions", href: "/barks" },
      { label: "Accountability Cases", href: "/cases" },
      { label: "Stories", href: "/stories" },
      { label: "Topics", href: "/topics" },
      { label: "Creators", href: "/creators" },
    ],
  },
  {
    heading: "Community",
    links: [
      { label: "Community Guidelines", href: "/policies/community-guidelines" },
      { label: "Evidence Standards", href: "/policies/evidence-standards" },
      { label: "Become a Writer", href: "/stories/apply" },
      { label: "Become a Creator", href: "/creators/apply" },
      { label: "Learning Center", href: "/learn" },
      { label: "Countries", href: "/countries" },
      { label: "Organizations", href: "/org" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/" },
      { label: "Policies", href: "/policies" },
      { label: "Enforcement & Appeals", href: "/policies/enforcement" },
      { label: "Settings", href: "/settings" },
      { label: "Sign in", href: "/sign-in" },
      { label: "Create account", href: "/sign-up" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-muted/30 pb-20 lg:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="TypeReact home"
          >
            <BrandLogo alt="" className="h-28 w-auto max-w-[20rem] sm:h-32" />
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">
            A platform where ideas compete through evidence, reasoning, and
            respectful debate.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.heading}>
            <p className="mb-3 text-sm font-semibold">{col.heading}</p>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground lg:px-6">
          © 2026 TypeReact. Evidence beats rumors. Logic beats popularity.
        </p>
      </div>
    </footer>
  );
}
