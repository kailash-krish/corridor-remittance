import type { Metadata } from "next";
import { SettingsClient } from "./client";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account settings.",
};

export default function SettingsPage() {
  return <SettingsClient />;
}
