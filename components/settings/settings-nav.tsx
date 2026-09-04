"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  Building2,
  Globe,
  Languages,
  Link2,
  Lock,
  ShieldCheck,
  UserCircle,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/settings", label: "Profile", icon: UserCircle },
  { href: "/settings/privacy", label: "Privacy", icon: Lock },
  { href: "/settings/mutes", label: "Mutes", icon: VolumeX },
  // { href: "/settings/security", label: "Security", icon: ShieldCheck },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/reading", label: "Reading", icon: BookOpen },
  // { href: "/settings/language", label: "Language", icon: Languages },
  { href: "/settings/country", label: "Country", icon: Globe },
  // { href: "/settings/accounts", label: "Connected Accounts", icon: Link2 },
  // { href: "/settings/organization", label: "Organization", icon: Building2 },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="flex gap-1 overflow-x-auto lg:flex-col"
    >
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
