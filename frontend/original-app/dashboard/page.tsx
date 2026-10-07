import type { Metadata } from "next";
import { DashboardHomeClient } from "./client";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Overview of your invoices and recent activity.",
};

export default function DashboardPage() {
  return <DashboardHomeClient />;
}
