"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/components/auth/require-admin";
import { useMyWriterApplication } from "@/components/stories/writer-cta";
import { UnreadCountBadge, MessagesUnreadBadge } from "@/components/notifications/unread-badge";
import { mainNav, personalNav, type NavItem } from "./nav-items";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-foreground/70 hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4.5 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {item.href === "/notifications" ? (
        <UnreadCountBadge />
      ) : item.href === "/messages" ? (
        <MessagesUnreadBadge />
      ) : item.badge ? (
        <Badge className="h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
          {item.badge}
        </Badge>
      ) : null}
    </Link>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isAdmin = useIsAdmin();
  const { loading, application } = useMyWriterApplication();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const personalItems = personalNav.flatMap((item) => {
    if (item.href !== "/stories/apply") return [item];
    if (loading) return [];
    if (application?.status === "approved") {
      return [
        {
          href: "/stories/dashboard",
          label: "Writer dashboard",
          icon: LayoutDashboard,
        },
      ];
    }
    if (application) return [];
    return [item];
  });

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full min-h-0 flex-col gap-1 overflow-y-auto p-3 lg:overscroll-contain"
      onClick={onNavigate}
    >
      {mainNav.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} />
      ))}
      <Separator className="my-2" />
      {personalItems.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} />
      ))}
      {isAdmin && (
        <>
          <Separator className="my-2" />
          <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Workspaces
          </p>
          <NavLink
            item={{ href: "/admin", label: "Admin Dashboard", icon: LayoutDashboard }}
            active={isActive("/admin")}
          />
        </>
      )}
    </nav>
  );
}
