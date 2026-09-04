"use client";

import * as React from "react";

/** Scrolls to `#ev-N` / `#block-N` after content mounts. */
export function PermalinkScroll() {
  React.useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const scrollToTarget = () => {
      const el = document.getElementById(hash);
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/40");
      window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary/40");
      }, 1800);
      return true;
    };

    if (scrollToTarget()) return;
    const t = window.setTimeout(() => {
      scrollToTarget();
    }, 120);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
