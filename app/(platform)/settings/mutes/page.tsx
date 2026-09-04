import type { Metadata } from "next";
import { MutesSettings } from "@/components/settings/mutes-form";

export const metadata: Metadata = {
  title: "Mute Settings",
};

export default function MutesSettingsPage() {
  return <MutesSettings />;
}
