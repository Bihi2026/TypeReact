"use client";

import Link from "next/link";
import { SignInButton, useUser } from "@clerk/nextjs";
import { PersonAvatar } from "@/components/person-avatar";

export function HomeComposeStrip() {
  const { isSignedIn, user } = useUser();
  const name = user?.fullName?.trim() || user?.firstName?.trim() || "You";
  const field = (
    <span className="flex h-11 min-w-0 flex-1 items-center rounded-full border bg-muted/50 px-4 text-sm text-muted-foreground transition-colors hover:bg-muted">
      Write a reaction…
    </span>
  );

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 sm:p-4">
      <PersonAvatar
        id={user?.id ?? "guest"}
        name={name}
        imageUrl={user?.imageUrl}
        className="size-10"
      />
      {isSignedIn ? (
        <Link
          href="/create"
          className="min-w-0 flex-1 rounded-full focus-visible:outline-2 focus-visible:outline-ring"
        >
          {field}
        </Link>
      ) : (
        <SignInButton>
          <button type="button" className="min-w-0 flex-1 text-left">
            {field}
          </button>
        </SignInButton>
      )}
    </div>
  );
}
