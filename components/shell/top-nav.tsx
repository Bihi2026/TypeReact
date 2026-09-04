"use client";

import * as React from "react";
import Link from "next/link";
import {
  OrganizationSwitcher,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import {
  Bell,
  Bookmark,
  Building2,
  Menu,
  Settings,
  UserCircle,
} from "lucide-react";
import { BrandLogo } from "@/components/shell/brand-logo";
import { SHELL_HEADER_HEIGHT } from "@/lib/shell";
import { cn } from "@/lib/utils";
import { CommandMenu } from "@/components/shell/command-menu";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { CreateBarkButton } from "@/components/auth/create-bark-button";
import {
  UnreadCountBadge,
  useUnreadNotificationCount,
} from "@/components/notifications/unread-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function Logo() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
      aria-label="TypeReact home"
    >
      <BrandLogo
        alt=""
        className="h-auto w-52 object-contain sm:w-[18rem] lg:w-[20rem]"
      />
    </Link>
  );
}

export function TopNav() {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const unread = useUnreadNotificationCount();

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className={cn("flex items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-6", SHELL_HEADER_HEIGHT)}>
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b px-4 py-4">
                <SheetTitle className="flex items-center text-left">
                  <BrandLogo className="h-auto w-full max-w-[20rem]" />
                </SheetTitle>
              </SheetHeader>
              <SidebarNav onNavigate={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>

          <Logo />
        </div>

        <div className="ml-auto hidden items-center gap-0.5 sm:ml-2 sm:flex sm:min-w-0 sm:flex-1 sm:justify-end sm:gap-1.5 md:justify-center">
          <CommandMenu />
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1.5">
          <CreateBarkButton />
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="relative hidden lg:inline-flex"
            aria-label={
              unread > 0
                ? `Notifications, ${unread} unread`
                : "Notifications"
            }
          >
            <Link href="/notifications">
              <Bell className="size-4.5" />
              <UnreadCountBadge compact />
            </Link>
          </Button>
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <Show when="signed-out">
            <SignInButton>
              <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton>
              <Button size="sm" className="hidden sm:inline-flex">
                Sign up
              </Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            {/*<div className="hidden lg:flex">*/}
            {/*  <OrganizationSwitcher*/}
            {/*    hidePersonal*/}
            {/*    afterCreateOrganizationUrl="/org"*/}
            {/*    afterSelectOrganizationUrl="/org"*/}
            {/*    afterLeaveOrganizationUrl="/"*/}
            {/*    appearance={{*/}
            {/*      elements: {*/}
            {/*        rootBox: "flex items-center",*/}
            {/*        organizationSwitcherTrigger:*/}
            {/*          "rounded-md border border-border px-2 py-1",*/}
            {/*      },*/}
            {/*    }}*/}
            {/*  />*/}
            {/*</div>*/}
            <UserButton>
              <UserButton.MenuItems>
                <UserButton.Link
                  href="/profile"
                  label="Profile"
                  labelIcon={<UserCircle className="size-4" />}
                />
                <UserButton.Link
                  href="/saved"
                  label="Saved Reactions"
                  labelIcon={<Bookmark className="size-4" />}
                />
                {/*<UserButton.Link*/}
                {/*  href="/org"*/}
                {/*  label="Organization"*/}
                {/*  labelIcon={<Building2 className="size-4" />}*/}
                {/*/>*/}
                {/*<UserButton.Link*/}
                {/*  href="/settings"*/}
                {/*  label="Settings"*/}
                {/*  labelIcon={<Settings className="size-4" />}*/}
                {/*/>*/}
              </UserButton.MenuItems>
            </UserButton>
          </Show>
        </div>
      </div>
    </header>
  );
}
