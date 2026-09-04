"use client";

import * as React from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { playNotificationChime } from "@/components/notifications/notification-sound";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { notificationCategoryMeta } from "@/lib/meta";
import type { NotificationCategory } from "@/lib/types";

const descriptions: Record<NotificationCategory, string> = {
  reply: "When someone replies to your reactions or reply chains.",
  mention: "When someone mentions you with @.",
  follower: "When someone starts following you.",
  following: "When someone you follow publishes a reaction.",
  "creator-response":
    "When a creator officially responds to a discussion you follow.",
  evidence: "When evidence is added or a case you follow changes status.",
  verification: "When your evidence or identity verification status changes.",
  message: "When someone sends you a private message about a reaction, case, or creator.",
  circle: "When you’re invited to a research circle or someone accepts your invite.",
};

const categoryPrefKey: Record<
  NotificationCategory,
  | "reply"
  | "mention"
  | "follower"
  | "followingActivity"
  | "creatorResponse"
  | "evidence"
  | "verification"
  | "message"
  | "circle"
> = {
  reply: "reply",
  mention: "mention",
  follower: "follower",
  following: "followingActivity",
  "creator-response": "creatorResponse",
  evidence: "evidence",
  verification: "verification",
  message: "message",
  circle: "circle",
};

const activityCategories: NotificationCategory[] = [
  "reply",
  "mention",
  "follower",
  "following",
];

const updateCategories: NotificationCategory[] = [
  "creator-response",
  "evidence",
  "verification",
  "message",
  "circle",
];

type PrefsState = {
  reply: boolean;
  mention: boolean;
  follower: boolean;
  followingActivity: boolean;
  creatorResponse: boolean;
  evidence: boolean;
  verification: boolean;
  message: boolean;
  circle: boolean;
  soundEnabled: boolean;
  emailEnabled: boolean;
  digestWeekly: boolean;
  digestCaseEmail: boolean;
};

const defaultPrefs: PrefsState = {
  reply: true,
  mention: true,
  follower: true,
  followingActivity: true,
  creatorResponse: true,
  evidence: true,
  verification: true,
  message: true,
  circle: true,
  soundEnabled: true,
  emailEnabled: true,
  digestWeekly: true,
  digestCaseEmail: true,
};

function PrefRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  trailing,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex justify-between gap-4">
                <div className="space-y-2">
                  <div className="h-4 w-28 animate-pulse rounded-md bg-muted" />
                  <div className="h-3 w-52 animate-pulse rounded-md bg-muted" />
                </div>
                <div className="h-5 w-9 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function NotificationSettingsForm() {
  const { isAuthenticated } = useConvexAuth();
  const remote = useQuery(
    api.notifications.getPrefs,
    isAuthenticated ? {} : "skip"
  );
  const updatePrefs = useMutation(api.notifications.updatePrefs);
  const [prefs, setPrefs] = React.useState<PrefsState>(defaultPrefs);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!remote) return;
    setPrefs({
      reply: remote.reply,
      mention: remote.mention,
      follower: remote.follower,
      followingActivity: remote.followingActivity ?? true,
      creatorResponse: remote.creatorResponse,
      evidence: remote.evidence,
      verification: remote.verification,
      message: remote.message,
      circle: remote.circle ?? true,
      soundEnabled: remote.soundEnabled,
      emailEnabled: remote.emailEnabled ?? true,
      digestWeekly: remote.digestWeekly,
      digestCaseEmail: remote.digestCaseEmail,
    });
  }, [remote]);

  const setFlag = (key: keyof PrefsState, value: boolean) => {
    setPrefs((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (!isAuthenticated) {
      toast.message("Sign in to save notification settings");
      return;
    }
    setSaving(true);
    try {
      await updatePrefs(prefs);
      toast.success("Settings saved", {
        description: "Your preferences have been updated.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save settings"
      );
    } finally {
      setSaving(false);
    }
  };

  if (isAuthenticated && remote === undefined) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            Replies, mentions, and people you follow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activityCategories.map((c) => {
            const key = categoryPrefKey[c];
            return (
              <PrefRow
                key={c}
                id={`notif-${c}`}
                label={notificationCategoryMeta[c].label}
                description={descriptions[c]}
                checked={prefs[key]}
                onCheckedChange={(checked) => setFlag(key, checked)}
              />
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Updates</CardTitle>
          <CardDescription>
            Creator responses, evidence, messages, and circles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {updateCategories.map((c) => {
            const key = categoryPrefKey[c];
            return (
              <PrefRow
                key={c}
                id={`notif-${c}`}
                label={notificationCategoryMeta[c].label}
                description={descriptions[c]}
                checked={prefs[key]}
                onCheckedChange={(checked) => setFlag(key, checked)}
              />
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
          <CardDescription>
            Sound, email, and digest preferences. Category switches above also
            apply to email delivery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PrefRow
            id="notif-sound"
            label="Notification sound"
            description="Play a short chime when a new notification arrives. Click the page once if the browser blocks audio."
            checked={prefs.soundEnabled}
            onCheckedChange={(checked) => setFlag("soundEnabled", checked)}
            trailing={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void playNotificationChime().then((played) => {
                    if (played) {
                      toast.success("Played notification sound");
                    } else {
                      toast.message(
                        "Click anywhere on the page, then try again"
                      );
                    }
                  });
                }}
              >
                Test sound
              </Button>
            }
          />
          <PrefRow
            id="email-enabled"
            label="Email notifications"
            description="Send an email for each in-app notification when this is on."
            checked={prefs.emailEnabled}
            onCheckedChange={(checked) => setFlag("emailEnabled", checked)}
          />
          <PrefRow
            id="digest-weekly"
            label="Weekly research digest"
            description="Coming soon — top reactions and case updates every Monday. Preference is saved for when digests ship."
            checked={prefs.digestWeekly}
            onCheckedChange={(checked) => setFlag("digestWeekly", checked)}
          />
          <PrefRow
            id="digest-case"
            label="Case status preference"
            description="Saved for future digest filtering. Case status changes already email when Email notifications and Evidence Updates are on."
            checked={prefs.digestCaseEmail}
            onCheckedChange={(checked) => setFlag("digestCaseEmail", checked)}
          />
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
