import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  CalendarDays,
  CalendarRange,
  Users,
  UserCog,
  Settings,
  Building2,
  LogOut,
  HelpCircle,
  ChevronsRight,
  ClipboardCheck,
  MessageSquare,
  UserPlus,
  Lightbulb,
  BarChart3,
  ClipboardList,
  History,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export type SidebarLink = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export type SidebarGroup = {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  links: SidebarLink[];
  includeLogout?: boolean;
};

export const dashboardLink: SidebarLink = {
  label: "Dashboard",
  href: "/dashboard",
  icon: Home,
  description: "Overview and important updates.",
};

export const sidebarGroups: SidebarGroup[] = [
  {
    id: "main",
    label: "Main",
    hint: "Daily work",
    icon: Home,
    links: [
      {
        label: "Approvals",
        href: "/approvals",
        icon: ClipboardCheck,
        description: "Review requests and approvals.",
      },
      {
        label: "Messaging",
        href: "/messaging",
        icon: MessageSquare,
        description: "Messages and conversations.",
      },
      {
        label: "Tasks",
        href: "/tasks",
        icon: ClipboardList,
        description: "Tasks and follow-ups.",
      },
    ],
  },
  {
    id: "clubs",
    label: "Clubs",
    hint: "People and organizations",
    icon: Building2,
    links: [
      {
        label: "Clubs",
        href: "/clubs",
        icon: Building2,
        description: "Club records and management.",
      },
      {
        label: "Prospects",
        href: "/prospects",
        icon: Lightbulb,
        description: "Prospective clubs.",
      },
      {
        label: "Officers",
        href: "/officers",
        icon: Users,
        description: "Officer management.",
      },
      {
        label: "Add Members",
        href: "/members/add",
        icon: UserPlus,
        description: "Add members quickly.",
      },
    ],
  },
  {
    id: "events",
    label: "Events",
    hint: "Planning and forms",
    icon: CalendarDays,
    links: [
      {
        label: "Events",
        href: "/events",
        icon: CalendarDays,
        description: "Manage events.",
      },
      {
        label: "Calendar",
        href: "/calendar",
        icon: CalendarRange,
        description: "View schedules.",
      },
      {
        label: "Forms",
        href: "/forms",
        icon: ClipboardList,
        description: "Forms and responses.",
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    hint: "Admin tools",
    icon: UserCog,
    links: [
      {
        label: "User Management",
        href: "/users",
        icon: UserCog,
        description: "Manage user access.",
      },
      {
        label: "Analytics",
        href: "/analytics",
        icon: BarChart3,
        description: "Reports and trends.",
      },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    hint: "Logs, settings, and help",
    icon: Settings,
    includeLogout: true,
    links: [
      {
        label: "Audit Log",
        href: "/audit-log",
        icon: History,
        description: "History of admin actions.",
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Workspace settings.",
      },
      {
        label: "Support",
        href: "/support",
        icon: HelpCircle,
        description: "Help and support.",
      },
    ],
  },
];

export const flatSidebarLinks: SidebarLink[] = [
  dashboardLink,
  ...sidebarGroups.flatMap((group) => group.links),
];

export const primaryLinks: SidebarLink[] = [dashboardLink];
export const manageLinks: SidebarLink[] = sidebarGroups
  .filter((group) => !["admin", "workspace"].includes(group.id))
  .flatMap((group) => group.links);
export const accountLinks: SidebarLink[] =
  sidebarGroups
    .filter((group) => ["admin", "workspace"].includes(group.id))
    .flatMap((group) => group.links);

const sidebarGroupOrder = ["main", "clubs", "events", "admin", "workspace"] as const;
const orderedSidebarGroups = sidebarGroupOrder
  .map((groupId) => sidebarGroups.find((group) => group.id === groupId))
  .filter((group): group is SidebarGroup => Boolean(group));

const SECTION_STORAGE_KEY = "cc.sidebar.sections.v1";

export function matchesSidebarPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarProps {
  className?: string;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

function Sidebar({ className, open, setOpen }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const defaultExpandedGroups = useMemo(
    () =>
      Object.fromEntries(
        sidebarGroups.map((group) => [
          group.id,
          group.links.some((link) => matchesSidebarPath(location.pathname, link.href)) ||
            group.id === "main",
        ]),
      ),
    [location.pathname],
  );

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(defaultExpandedGroups);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SECTION_STORAGE_KEY);
      if (!stored) {
        setExpandedGroups(defaultExpandedGroups);
        return;
      }

      const parsed = JSON.parse(stored) as Record<string, boolean>;
      setExpandedGroups({ ...defaultExpandedGroups, ...parsed });
    } catch {
      setExpandedGroups(defaultExpandedGroups);
    }
  }, [defaultExpandedGroups]);

  useEffect(() => {
    setExpandedGroups((current) => {
      const next = { ...current };
      let changed = false;

      sidebarGroups.forEach((group) => {
        const hasActiveChild = group.links.some((link) => matchesSidebarPath(location.pathname, link.href));
        if (hasActiveChild && !next[group.id]) {
          next[group.id] = true;
          changed = true;
        }
      });

      if (changed) {
        try {
          window.localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Keep navigation usable if storage is unavailable.
        }
      }

      return changed ? next : current;
    });
  }, [location.pathname]);

  const updateExpandedGroup = (groupId: string, nextValue: boolean) => {
    setExpandedGroups((current) => {
      const next = { ...current, [groupId]: nextValue };

      try {
        window.localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Keep navigation usable if storage is unavailable.
      }

      return next;
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside className={cn("hidden md:block", className)}>
      <nav
        className={cn(
          "flex h-full flex-col border-r border-slate-300 bg-[#f7f7f5] text-slate-700 transition-all duration-200",
          open ? "w-64" : "w-20",
        )}
      >
        <div className={cn("border-b border-slate-300 px-4 py-4", !open && "px-3")}>
          <div className={cn("flex items-center gap-3", !open && "justify-center")}>
            <Logo />
            {open ? (
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">Connect Camp</p>
                <p className="text-xs text-slate-500">Admin Dashboard</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {open ? (
            <div className="space-y-5">
              <div>
                <SectionLabel label="Home" />
                <div className="mt-1">
                  <NavItem link={dashboardLink} open />
                </div>
              </div>

              {orderedSidebarGroups.map((group) => (
                <DropdownSection
                  key={group.id}
                  group={group}
                  open
                  expanded={expandedGroups[group.id] ?? false}
                  onExpandedChange={(value) => updateExpandedGroup(group.id, value)}
                  onSignOut={handleSignOut}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3 px-2">
              <CompactNavItem link={dashboardLink} />
              {orderedSidebarGroups.map((group) => (
                <CompactCollapsedGroup key={group.id} group={group} />
              ))}
              <CompactSignOutButton onClick={handleSignOut} />
            </div>
          )}
        </div>

        <div className="border-t border-slate-300 p-3">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className={cn(
              "flex h-10 w-full items-center border border-transparent px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900",
              open ? "justify-between" : "justify-center px-0",
            )}
            aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          >
            {open ? <span>Collapse menu</span> : null}
            <ChevronsRight className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </nav>
    </aside>
  );
}

function DropdownSection({
  group,
  expanded,
  onExpandedChange,
  onSignOut,
}: {
  group: SidebarGroup;
  open: boolean;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
  onSignOut: () => Promise<void>;
}) {
  const location = useLocation();
  const hasActiveChild = group.links.some((link) => matchesSidebarPath(location.pathname, link.href));
  const GroupIcon = group.icon;

  return (
    <section>
      <SectionLabel label={group.label} />
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        className={cn(
          "mt-1 flex h-10 w-full items-center justify-between border-y border-slate-300 bg-transparent px-4 text-left text-sm font-medium transition-colors",
          hasActiveChild ? "text-slate-900" : "text-slate-700 hover:bg-slate-100",
        )}
      >
        <span className="flex items-center gap-3">
          <GroupIcon className="h-4 w-4 shrink-0" />
          <span>{group.label}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded ? (
        <div className="border-b border-slate-300 bg-white/70 py-1">
          {group.links.map((link) => (
            <NavItem key={link.href} link={link} open />
          ))}
          {group.includeLogout ? <SignOutButton open onClick={onSignOut} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function NavItem({ link, open }: { link: SidebarLink; open: boolean }) {
  const location = useLocation();
  const Icon = link.icon;
  const isActive = matchesSidebarPath(location.pathname, link.href);

  return (
    <NavLink
      to={link.href}
      className={({ isActive: routeActive }) =>
        cn(
          "flex items-center gap-3 border-l-2 px-6 py-2.5 text-sm transition-colors",
          !open && "justify-center border-l-0 px-0",
          routeActive || isActive
            ? "border-slate-900 bg-slate-200/70 font-semibold text-slate-950"
            : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        )
      }
      title={!open ? link.label : undefined}
      aria-label={link.label}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {open ? <span className="truncate">{link.label}</span> : null}
    </NavLink>
  );
}

function CompactNavItem({ link }: { link: SidebarLink }) {
  const location = useLocation();
  const Icon = link.icon;
  const isActive = matchesSidebarPath(location.pathname, link.href);

  return (
    <NavLink
      to={link.href}
      className={({ isActive: routeActive }) =>
        cn(
          "flex h-10 items-center justify-center border-l-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900",
          routeActive || isActive
            ? "border-slate-900 bg-slate-200/70 text-slate-950"
            : "border-transparent",
        )
      }
      title={link.label}
      aria-label={link.label}
    >
      <Icon className="h-5 w-5 shrink-0" />
    </NavLink>
  );
}

function CompactCollapsedGroup({ group }: { group: SidebarGroup }) {
  const GroupIcon = group.icon;

  return (
    <div className="rounded-[18px] border border-slate-200/80 bg-white/70 py-2 shadow-sm">
      <div className="px-2 text-center">
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          {group.label}
        </p>
      </div>
      <div className="flex justify-center py-1.5">
        <div className="grid size-7 place-content-center rounded-xl bg-slate-100 text-slate-500">
          <GroupIcon className="h-4 w-4" />
        </div>
      </div>
      <div className="space-y-1">
        {group.links.map((link) => (
          <CompactNavItem key={link.href} link={link} />
        ))}
      </div>
    </div>
  );
}

function SignOutButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-l-2 border-transparent px-6 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900",
        !open && "justify-center border-l-0 px-0",
      )}
      title={!open ? "Sign out" : undefined}
      aria-label="Sign out"
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {open ? <span>Sign out</span> : null}
    </button>
  );
}

function CompactSignOutButton({ onClick }: { onClick: () => Promise<void> }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center justify-center border-l-2 border-transparent text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      title="Sign out"
      aria-label="Sign out"
    >
      <LogOut className="h-5 w-5 shrink-0" />
    </button>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
      {label}
    </p>
  );
}

function Logo() {
  return (
    <div className="grid h-10 w-10 shrink-0 place-content-center bg-slate-900 text-white">
      <svg viewBox="0 0 128 128" className="h-5 w-5" aria-hidden="true" focusable="false">
        <rect width="128" height="128" rx="18" fill="currentColor" />
        <path
          fill="#0f172a"
          d="M64 18c-25.4 0-46 20.6-46 46s20.6 46 46 46c11.2 0 21.8-4 30.1-11.4l-14-16.8A23 23 0 0 1 64 85c-13 0-23.6-10.6-23.6-23.7S51 37.5 64 37.5c7.7 0 14.7 3.7 19.2 9.6l13.9-16.7C88.7 22 76.8 18 64 18Z"
        />
        <circle cx="64" cy="61.3" r="11" fill="#fff" />
      </svg>
    </div>
  );
}

export default Sidebar;
