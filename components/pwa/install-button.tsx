"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { usePWA } from "@/hooks/use-pwa";
import { Button, type buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

interface PWAInstallButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  iconOnly?: boolean;
  label?: string;
}

export function PWAInstallButton({
  variant = "outline",
  size = "sm",
  iconOnly = false,
  label = "Install App",
  className,
  ...props
}: PWAInstallButtonProps) {
  const { isInstalled, isStandalone, isPromptPending, promptInstall } =
    usePWA();

  if (isInstalled || isStandalone) {
    return null;
  }

  return (
    <Button
      {...props}
      variant={variant}
      size={size}
      disabled={isPromptPending || props.disabled}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
          void promptInstall();
        }
      }}
      className={cn(
        "gap-1.5 transition-all",
        iconOnly ? "size-8 p-0" : "",
        className
      )}
      title="Install TypeReact App"
      aria-label="Install TypeReact as Progressive Web App"
    >
      {isPromptPending ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-[#E83F00]" />
      ) : (
        <Download className="size-4 shrink-0 text-[#E83F00]" />
      )}
      {!iconOnly && (
        <span>{isPromptPending ? "Preparing…" : label}</span>
      )}
    </Button>
  );
}
