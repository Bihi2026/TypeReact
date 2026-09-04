"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

function anonymousViewerKey() {
  const key = "bark-viewer-key";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, next);
    return next;
  } catch {
    return `anon-session-${Date.now()}`;
  }
}

export function BarkViewRecorder({ code }: { code: string }) {
  const { userId } = useAuth();
  const recordView = useMutation(api.barks.recordView);

  React.useEffect(() => {
    const sessionKey = `bark-view:${code}:${new Date().toISOString().slice(0, 10)}`;
    try {
      if (sessionStorage.getItem(sessionKey)) return;
    } catch {
      // continue; server still dedupes
    }
    const viewerKey = userId ?? anonymousViewerKey();
    void recordView({ code, viewerKey }).then(() => {
      try {
        sessionStorage.setItem(sessionKey, "1");
      } catch {
        // ignore quota / private mode
      }
    });
  }, [code, recordView, userId]);

  return null;
}
