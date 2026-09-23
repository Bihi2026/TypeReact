"use client";

import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function HomeSignupCard() {
  return (
    <Show when="signed-out">
      <div className="rounded-xl bg-[#1a1520] p-5 text-white">
        <h3 className="text-base font-semibold">Be Part of the Change</h3>
        <p className="mt-1.5 text-sm text-white/70">
          Create an account to follow discussions, write reactions, and join
          the public record.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <SignUpButton>
            <Button className="w-full">Create account</Button>
          </SignUpButton>
          <SignInButton>
            <Button
              variant="outline"
              className="w-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Sign in
            </Button>
          </SignInButton>
        </div>
      </div>
    </Show>
  );
}
