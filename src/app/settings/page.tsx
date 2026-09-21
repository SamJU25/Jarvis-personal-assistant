import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";

export const metadata: Metadata = { title: "Settings · JARVIS" };

export default function SettingsPage() {
  return <SettingsShell />;
}
