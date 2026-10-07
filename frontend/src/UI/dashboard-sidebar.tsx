"use client";

import {
  Suspense,
  useEffect,
  useState,
  type ElementType,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CircleCheck,
  CircleDot,
  CirclePlus,
  Clock,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  TrendingUp,
} from "lucide-react";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";

/* ------------------------------------------------------------------ */
/* Navigation config: edit this to change the sidebar                  */
/* ------------------------------------------------------------------ */

export type NavItemData = {
  id: string;
  title: string;
  icon: ElementType;
  href: string;
  children?: NavItemData[];
};

export type NavGroupData = {
  heading?: string;
  items: NavItemData[];
};

export type SidebarUser = {
  email: string;
  name?: string | null;
};

export const NAV_GROUPS: NavGroupData[] = [
  {
    items: [
      { id: "dashboard", title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { id: "new", title: "New entry", icon: CirclePlus, href: "/dashboard/new" },
    ],
  },
  {
    heading: "Work",
    items: [
      {
        id: "invoices",
        title: "Invoices",
        icon: FileText,
        href: "/dashboard/invoices",
        children: [
          { id: "inv-open", title: "Open", icon: CircleDot, href: "/dashboard/invoices?status=open" },
          { id: "inv-progress", title: "In progress", icon: Clock, href: "/dashboard/invoices?status=in_progress" },
          { id: "inv-closed", title: "Closed", icon: CircleCheck, href: "/dashboard/invoices?status=closed" },
        ],
      },
      { id: "tracks", title: "Tracks", icon: TrendingUp, href: "/dashboard/tracks" },
    ],
  },
];

export const BOTTOM_ITEMS: NavItemData[] = [
  { id: "settings", title: "Settings", icon: Settings, href: "/dashboard/settings" },
];

const ALL_ITEMS: NavItemData[] = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  ...BOTTOM_ITEMS,
].flatMap((item) => [item, ...(item.children ?? [])]);

function pathOf(href: string) {
  return href.split("?")[0];
}

function pageTitle(pathname: string) {
  let best: NavItemData | undefined;
  for (const item of ALL_ITEMS) {
    const p = pathOf(item.href);
    if (pathname === p || pathname.startsWith(p + "/")) {
      if (!best || p.length > pathOf(best.href).length) best = item;
    }
  }
  return best?.title ?? "Dashboard";
}

/* ------------------------------------------------------------------ */
/* Active-link logic                                                   */
/* ------------------------------------------------------------------ */

function useIsActive() {
  const pathname = usePathname();
  const search = useSearchParams();

  return (href: string) => {
    const [path, query] = href.split("?");
    if (query) {
      if (pathname !== path) return false;
      for (const [key, value] of new URLSearchParams(query)) {
        if (search.get(key) !== value) return false;
      }
      return true;
    }
    if (path === "/dashboard") return pathname === "/dashboard";
    return pathname === path || pathname.startsWith(path + "/");
  };
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

function NavItem({
  item,
  level = 0,
  badges,
  isActive,
}: {
  item: NavItemData;
  level?: number;
  badges: Record<string, number>;
  isActive: (href: string) => boolean;
}) {
  const hasChildren = !!item.children?.length;
  const childActive = !!item.children?.some((c) => isActive(c.href));
  const active = isActive(item.href) && !childActive;
  const [open, setOpen] = useState(childActive);
  const badge = badges[item.id];

  const expanded = open || childActive;

  return (
    <div className="flex w-full flex-col">
      <div
        className={`group flex items-center rounded-[6px] transition-colors duration-200 ${
          active
            ? "relative overflow-hidden bg-blue-500/10 text-foreground font-medium before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-blue-400"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
        }`}
      >
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-2.5 py-[7px] pr-1 select-none"
          style={{ paddingLeft: `${level * 12 + 10}px` }}
        >
          <item.icon
            className={`h-[16px] w-[16px] shrink-0 transition-colors ${
              active ? "text-foreground" : "text-muted-foreground/70 group-hover:text-foreground/70"
            }`}
            strokeWidth={1.5}
          />
          <span className="truncate text-[13px] tracking-wide">{item.title}</span>
        </Link>

        {badge ? (
          <span className="mr-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
            {badge}
          </span>
        ) : null}

        {hasChildren && (
          <button
            type="button"
            onClick={() => setOpen(!expanded)}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${item.title}`}
            aria-expanded={expanded}
            className="p-2 text-muted-foreground/60 hover:text-foreground"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
              strokeWidth={2}
            />
          </button>
        )}
      </div>

      {hasChildren && (
        <div
          className={`grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-in-out ${
            expanded ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="relative mt-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden">
            <div
              className="absolute bottom-0 top-0 border-l border-white/10"
              style={{ left: `${level * 12 + 17.5}px` }}
            />
            {item.children!.map((child) => (
              <NavItem
                key={child.id}
                item={child}
                level={level + 1}
                badges={badges}
                isActive={isActive}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export interface SidebarNavProps {
  className?: string;
  user: SidebarUser;
  /** Counts shown as pills, keyed by nav item id, e.g. { "inv-open": 5 } */
  badges?: Record<string, number>;
  onLogout: () => Promise<void> | void;
}

function SidebarContent({ className = "", user, badges = {}, onLogout }: SidebarNavProps) {
  const isActive = useIsActive();
  const [loggingOut, setLoggingOut] = useState(false);
  const label = user.name?.trim() || user.email;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div
      className={`flex h-full w-[260px] flex-col border-r border-white/10 bg-card p-3 font-sans backdrop-blur-xl ${className}`}
    >
      <Link href="/dashboard" className="mb-4 flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-primary text-primary-foreground shadow-sm">
          <Mail className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="mb-1 truncate text-[13px] font-medium leading-none text-foreground">
            Invoice Mailer
          </span>
          <span className="text-[11px] leading-none text-muted-foreground">Trader workspace</span>
        </div>
      </Link>

      <nav className="mt-2 flex flex-1 flex-col gap-4 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_GROUPS.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-0.5">
            {group.heading && (
              <span className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.heading}
              </span>
            )}
            {group.items.map((item) => (
              <NavItem key={item.id} item={item} badges={badges} isActive={isActive} />
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-border/50 pt-4">
        {BOTTOM_ITEMS.map((item) => (
          <NavItem key={item.id} item={item} badges={badges} isActive={isActive} />
        ))}

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-60"
        >
          <LogOut
            className="h-[16px] w-[16px] text-muted-foreground/70 group-hover:text-foreground/70"
            strokeWidth={1.5}
          />
          <span className="text-[13px] tracking-wide">
            {loggingOut ? "Logging out..." : "Log out"}
          </span>
        </button>

        <div className="mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[12px] font-semibold text-primary">
            {label.charAt(0).toUpperCase()}
          </div>
          <span className="truncate text-[12px] text-muted-foreground" title={user.email}>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Sidebar. Wrapped in Suspense because it reads the URL query string. */
export function SidebarNav(props: SidebarNavProps) {
  return (
    <Suspense
      fallback={
        <div className={`h-full w-[260px] border-r border-white/10 bg-card backdrop-blur-xl ${props.className ?? ""}`} />
      }
    >
      <SidebarContent {...props} />
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/* Shell: sidebar + top bar + content area                             */
/* ------------------------------------------------------------------ */

export function DashboardShell({
  user,
  badges,
  onLogout,
  children,
}: {
  user: SidebarUser;
  badges?: Record<string, number>;
  onLogout: () => Promise<void> | void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const mobileOpen = mobileMenuPath === pathname;

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/dashboard/invoices?q=${encodeURIComponent(q)}`);
  }

  const initial = (user.name?.trim() || user.email).charAt(0).toUpperCase();

  return (
    <DarkGradientBg className="h-screen">
      <div className="flex h-full w-full overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuPath(null)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] shrink-0 transition-transform duration-300 ease-in-out md:static md:z-auto md:translate-x-0 md:transition-[margin] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${desktopOpen ? "" : "md:-ml-[260px]"}`}
      >
        <SidebarNav user={user} badges={badges} onLogout={onLogout} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-cyan-100/10 bg-slate-950/65 px-4 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuPath(pathname)}
              aria-label="Open menu"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground md:hidden"
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setDesktopOpen((o) => !o)}
              aria-label={desktopOpen ? "Collapse sidebar" : "Expand sidebar"}
              className="hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground md:inline-flex"
            >
              {desktopOpen ? (
                <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.5} />
              ) : (
                <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.5} />
              )}
            </button>
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <span className="hidden truncate sm:inline">Invoice Mailer</span>
              <span className="hidden sm:inline">/</span>
              <span className="truncate font-medium text-foreground">{pageTitle(pathname)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <form onSubmit={handleSearch} role="search" className="relative hidden lg:block">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                strokeWidth={1.5}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search invoice no. or track"
                aria-label="Search invoices"
                className="h-9 w-64 rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-cyan-400/40"
              />
            </form>
            <Link
              href="/dashboard/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-300"
            >
              <CirclePlus className="h-4 w-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">New entry</span>
            </Link>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[13px] font-semibold text-primary"
              title={user.email}
            >
              {initial}
            </div>
          </div>
        </header>

        <main className="dashboard-canvas flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
      </div>
    </DarkGradientBg>
  );
}
