import type { ReactNode } from "react";
import { DashboardShellClient } from "./shell-client";

/**
 * Standalone Dashboard Layout for UI design & prototyping.
 * Provides a mock authenticated user session without any backend/Supabase dependencies.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShellClient
      userEmail="trader@invoice-ai.local"
      userName="Priya Sharma"
    >
      {children}
    </DashboardShellClient>
  );
}
