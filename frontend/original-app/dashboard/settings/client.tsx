"use client";

import { useState } from "react";
import { Settings, User, Bell, Shield } from "lucide-react";
import { signOut } from "@/lib/auth/actions";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
];

export function SettingsClient() {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Settings className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="gradient-text text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account preferences</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        {/* Sidebar nav */}
        <aside className="w-full shrink-0 sm:w-44">
          <nav className="flex gap-1 overflow-x-auto sm:flex-col">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                id={`settings-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-blue-500/15 text-blue-200 font-medium ring-1 ring-blue-400/20"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" strokeWidth={1.5} />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {activeTab === "profile" && (
            <SettingsCard title="Profile" description="Your public profile information.">
              <div className="space-y-4 pt-2">
                <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
                  Profile editing coming soon. Your email is managed via Supabase Auth.
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                  }}
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                >
                  Sign out
                </button>
              </div>
            </SettingsCard>
          )}

          {activeTab === "notifications" && (
            <SettingsCard title="Notifications" description="Control when and how you receive notifications.">
              <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
                Notification preferences coming soon.
              </div>
            </SettingsCard>
          )}

          {activeTab === "security" && (
            <SettingsCard title="Security" description="Manage your password and account security.">
              <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
                Password management coming soon. Use the &quot;Forgot password&quot; flow from the login page.
              </div>
            </SettingsCard>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-card p-6 shadow-lg shadow-black/10 backdrop-blur-xl">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}
