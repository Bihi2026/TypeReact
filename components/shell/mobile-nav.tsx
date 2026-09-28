"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CircleHelp,
  Compass,
  Home,
  MoreHorizontal,
  PenSquare,
  UserCircle,
} from "lucide-react";
import { UnreadCountBadge } from "@/components/notifications/unread-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { mainNav, personalNav, type NavItem } from "./nav-items";

const barItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/create", label: "Create", icon: PenSquare, primary: true },
  { href: "/AskQuestions", label: "Ask Questions", icon: CircleHelp },
];

const pinnedMore: NavItem[] = [
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

const barHrefs = new Set(["/", "/explore", "/create", "/AskQuestions"]);

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreItems = [
    ...pinnedMore,
    ...mainNav.filter((item) => !barHrefs.has(item.href)),
    ...personalNav.filter(
      (item) => item.href !== "/notifications" && item.href !== "/profile"
    ),
  ];
  const moreActive = moreItems.some((item) => isActive(pathname, item.href));

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden"
    >
      <div className="grid grid-cols-5">
        {barItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
                item.primary
                  ? "text-primary"
                  : active
                    ? "text-foreground"
                    : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "relative flex items-center justify-center rounded-full",
                  item.primary &&
                    "size-8 -mt-1 bg-primary text-primary-foreground"
                )}
              >
                <Icon className={cn("size-5", item.primary && "size-4.5")} />
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-label="View more options"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
            moreActive || moreOpen ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <span className="relative flex items-center justify-center">
            <MoreHorizontal className="size-5" />
            <UnreadCountBadge compact className="-right-1 -top-1" />
          </span>
          More
        </button>
      </div>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[70svh] gap-0 pb-6">
          <SheetHeader>
            <SheetTitle>More options</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-2 pb-2">
            {moreItems.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/80"
                  )}
                >
                  <Icon className="size-4.5 shrink-0" aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/notifications" ? <UnreadCountBadge /> : null}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
