import { MobileNav } from "@/components/shell/mobile-nav";
import { PlatformMain } from "@/components/shell/platform-main";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { TopNav } from "@/components/shell/top-nav";
import { NotificationSound } from "@/components/notifications/notification-sound";
import {
  SHELL_HEADER_OFFSET,
  SHELL_SIDEBAR_OFFSET,
  SHELL_SIDEBAR_WIDTH,
  SHELL_STICKY_HEIGHT,
  SHELL_STICKY_TOP,
} from "@/lib/shell";
import { cn } from "@/lib/utils";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh min-w-0 flex-col overflow-x-hidden">
      <TopNav />
      <NotificationSound />
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1",
          SHELL_HEADER_OFFSET,
          SHELL_SIDEBAR_OFFSET
        )}
      >
        <aside
          className={cn(
            "fixed left-0 z-30 hidden shrink-0 overflow-y-auto border-r bg-background lg:block",
            SHELL_SIDEBAR_WIDTH,
            SHELL_STICKY_TOP,
            SHELL_STICKY_HEIGHT
          )}
        >
          <SidebarNav />
        </aside>
        <PlatformMain>{children}</PlatformMain>
      </div>
      <MobileNav />
    </div>
  );
}
