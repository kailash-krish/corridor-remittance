"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/UI/dashboard-sidebar";
import { signOut } from "@/lib/auth/actions";

interface Props {
  userEmail: string;
  userName: string | null;
  children: ReactNode;
}

export function DashboardShellClient({ userEmail, userName, children }: Props) {
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  return (
    <DashboardShell
      user={{ email: userEmail, name: userName }}
      onLogout={handleLogout}
    >
      {children}
    </DashboardShell>
  );
}
