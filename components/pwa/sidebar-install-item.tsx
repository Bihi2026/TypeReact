"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { usePWA } from "@/hooks/use-pwa";
import { cn } from "@/lib/utils";

export function SidebarInstallItem() {
  const { isInstalled, isStandalone, isPromptPending, promptInstall } =
    usePWA();

  if (isInstalled || isStandalone) {
    return null;
  }

  return (
    <button
      type="button"
      disabled={isPromptPending}
      onClick={() => {
        void promptInstall();
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/10",
        isPromptPending && "opacity-70"
      )}
    >
      {isPromptPending ? (
        <Loader2
          className="size-4.5 shrink-0 animate-spin text-[#E83F00]"
          aria-hidden
        />
      ) : (
        <Download className="size-4.5 shrink-0 text-[#E83F00]" aria-hidden />
      )}
      <span className="flex-1 truncate font-medium">
        {isPromptPending ? "Preparing…" : "Install App"}
      </span>
      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
        PWA
      </span>
    </button>
  );
}
