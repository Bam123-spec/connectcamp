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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export type SidebarLink = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type SidebarGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  links: SidebarLink[];
  includeLogout?: boolean;
};

export const dashboardLink: SidebarLink = { label: "Dashboard", href: "/", icon: Home };

export const sidebarGroups: SidebarGroup[] = [
  {
    id: "organizations",
    label: "Organizations",
    icon: Building2,
    links: [
      { label: "Clubs", href: "/clubs", icon: Building2 },
      { label: "Prospects", href: "/prospects", icon: Lightbulb },
      { label: "Officers", href: "/officers", icon: Users },
    ],
  },
  {
    id: "programming",
    label: "Programming",
    icon: CalendarDays,
    links: [
      { label: "Events", href: "/events", icon: CalendarDays },
      { label: "Calendar", href: "/calendar", icon: CalendarRange },
      { label: "Forms", href: "/forms", icon: ClipboardList },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: ClipboardCheck,
    links: [
      { label: "Approvals", href: "/approvals", icon: ClipboardCheck },
      { label: "Tasks", href: "/tasks", icon: ClipboardList },
      { label: "Messaging", href: "/messaging", icon: MessageSquare },
      { label: "Audit Log", href: "/audit-log", icon: History },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: UserCog,
    links: [
      { label: "User Management", href: "/users", icon: UserCog },
      { label: "Add Members", href: "/members/add", icon: UserPlus },
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
    ],
  },
  {
    id: "account",
    label: "Account",
    icon: Settings,
    includeLogout: true,
    links: [
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Support", href: "/support", icon: HelpCircle },
    ],
  },
];

export const flatSidebarLinks: SidebarLink[] = [
  dashboardLink,
  ...sidebarGroups.flatMap((group) => group.links),
];

export const primaryLinks: SidebarLink[] = [dashboardLink];
export const manageLinks: SidebarLink[] = sidebarGroups
  .filter((group) => group.id !== "account")
  .flatMap((group) => group.links);
export const accountLinks: SidebarLink[] = sidebarGroups
  .find((group) => group.id === "account")
  ?.links ?? [];

const GROUP_STORAGE_KEY = "cc-sidebar-groups-v2";

export function matchesSidebarPath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
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

  const defaultGroupState = useMemo(
    () =>
      Object.fromEntries(
        sidebarGroups.map((group) => [
          group.id,
          group.links.some((link) => matchesSidebarPath(location.pathname, link.href)) || group.id === "organizations",
        ]),
      ),
    [location.pathname],
  );

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(defaultGroupState);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GROUP_STORAGE_KEY);
      if (!stored) {
        setExpandedGroups(defaultGroupState);
        return;
      }

      const parsed = JSON.parse(stored) as Record<string, boolean>;
      setExpandedGroups({ ...defaultGroupState, ...parsed });
    } catch {
      setExpandedGroups(defaultGroupState);
    }
  }, [defaultGroupState]);

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
          window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore localStorage issues and keep navigation usable.
        }
      }

      return changed ? next : current;
    });
  }, [location.pathname]);

  const setGroupExpanded = (groupId: string, value: boolean) => {
    setExpandedGroups((current) => {
      const next = { ...current, [groupId]: value };
      try {
        window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage issues and keep navigation usable.
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
          "relative flex h-full flex-col overflow-hidden border-r border-slate-200 bg-[linear-gradient(180deg,#fafcff_0%,#f5f8fc_100%)] p-3 text-slate-600 shadow-[10px_0_30px_rgba(148,163,184,0.08)] transition-all duration-300 ease-in-out",
          open ? "w-64" : "w-20",
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.22),transparent_24%)]" />
        <TitleSection open={open} />
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <SectionCard open={open}>
            {open && <SectionLabel label="Workspace" />}
            <Option Icon={dashboardLink.icon} title={dashboardLink.label} href={dashboardLink.href} open={open} />
          </SectionCard>

          <div className="mt-4 space-y-4">
            {sidebarGroups.map((group) => (
              <SidebarGroupSection
                key={group.id}
                group={group}
                open={open}
                expanded={expandedGroups[group.id] ?? false}
                onExpandedChange={(value) => setGroupExpanded(group.id, value)}
                onSignOut={handleSignOut}
              />
            ))}
          </div>
        </div>

        <ToggleClose open={open} setOpen={setOpen} />
      </nav>
    </aside>
  );
}

function SidebarGroupSection({
  group,
  open,
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

  if (!open) {
    return (
      <SectionCard open={open}>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "group flex h-11 w-full items-center justify-center rounded-2xl transition-all duration-200",
                hasActiveChild ? "bg-slate-900 text-white shadow-[0_10px_22px_rgba(15,23,42,0.16)]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
              )}
              title={group.label}
              aria-label={group.label}
            >
              <GroupIcon className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-64 rounded-[22px] border-slate-200 p-3">
            <div className="mb-2 flex items-center gap-3 px-2 py-1">
              <div className="grid h-9 w-9 place-content-center rounded-2xl bg-slate-100 text-slate-700">
                <GroupIcon className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">{group.label}</p>
                <p className="text-xs text-slate-500">Grouped workspace tools</p>
              </div>
            </div>
            <div className="space-y-1">
              {group.links.map((link) => (
                <Option key={link.href} Icon={link.icon} title={link.label} href={link.href} open />
              ))}
              {group.includeLogout ? <SignOutButton open onClick={onSignOut} /> : null}
            </div>
          </PopoverContent>
        </Popover>
      </SectionCard>
    );
  }

  return (
    <SectionCard open={open}>
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
          hasActiveChild ? "bg-slate-100 text-slate-950" : "text-slate-700 hover:bg-slate-50",
        )}
      >
        <div className="grid h-9 w-9 place-content-center rounded-2xl bg-slate-100 text-slate-700">
          <GroupIcon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{group.label}</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded ? (
        <div className="mt-2 space-y-1 border-t border-slate-200/80 pt-2">
          {group.links.map((link) => (
            <Option key={link.href} Icon={link.icon} title={link.label} href={link.href} open={open} />
          ))}
          {group.includeLogout ? <SignOutButton open={open} onClick={onSignOut} /> : null}
        </div>
      ) : null}
    </SectionCard>
  );
}

function Option({
  Icon,
  title,
  href,
  open,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  href: string;
  open: boolean;
}) {
  const location = useLocation();

  return (
    <NavLink
      to={href}
      className={({ isActive }) => {
        const isPathActive = isActive || matchesSidebarPath(location.pathname, href);

        return cn(
          "group relative flex h-10 w-full items-center rounded-2xl px-3 transition-all duration-200",
          !open && "justify-center px-0",
          isPathActive
            ? "bg-slate-900 text-white shadow-[0_10px_22px_rgba(15,23,42,0.16)]"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
        );
      }}
      title={!open ? title : undefined}
      aria-label={title}
    >
      <div className={cn("flex items-center justify-center rounded-xl transition-colors duration-200", open ? "h-8 w-8" : "h-10 w-10")}>
        <Icon className="h-5 w-5" />
      </div>
      <div className={cn("flex flex-1 items-center overflow-hidden transition-all duration-300", open ? "ml-3 opacity-100" : "ml-0 w-0 opacity-0")}>
        <span className="whitespace-nowrap text-sm font-medium">{title}</span>
      </div>
    </NavLink>
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
        "group relative flex h-10 w-full items-center rounded-2xl px-3 text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-950",
        !open && "justify-center px-0",
      )}
      title={!open ? "Logout" : undefined}
      aria-label="Logout"
    >
      <div className={cn("flex items-center justify-center rounded-xl transition-colors duration-200", open ? "h-8 w-8" : "h-10 w-10")}>
        <LogOut className="h-5 w-5" />
      </div>
      <div className={cn("flex flex-1 items-center overflow-hidden transition-all duration-300", open ? "ml-3 opacity-100" : "ml-0 w-0 opacity-0")}>
        <span className="whitespace-nowrap text-sm font-medium">Logout</span>
      </div>
    </button>
  );
}

function SectionCard({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[22px] border border-slate-200/90 bg-white/80 p-2 shadow-[0_8px_20px_rgba(148,163,184,0.05)]",
        !open && "px-2",
      )}
    >
      {children}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{label}</div>;
}

const TitleSection = ({ open }: { open: boolean }) => {
  return (
    <div className={cn("relative px-1", open ? "mb-5" : "mb-4")}>
      <div
        className={cn(
          "flex items-center gap-3 overflow-hidden rounded-[24px] border border-slate-200/90 bg-white/88 px-3 py-3 shadow-[0_10px_24px_rgba(148,163,184,0.06)]",
          !open && "justify-center px-2",
        )}
      >
        <Logo />
        <div className={cn("flex flex-col transition-all duration-300", open ? "opacity-100" : "w-0 opacity-0")}>
          <span className="whitespace-nowrap text-base font-bold tracking-tight text-slate-950">Connect Camp</span>
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Admin Workspace</span>
        </div>
      </div>
    </div>
  );
};

const Logo = () => (
  <div className="grid size-10 shrink-0 place-content-center rounded-[18px] bg-[linear-gradient(145deg,#0f172a_0%,#1e293b_62%,#334155_100%)] text-white shadow-[0_10px_20px_rgba(15,23,42,0.16)] ring-1 ring-white/80">
    <svg viewBox="0 0 128 128" className="h-5 w-5" aria-hidden="true" focusable="false">
      <rect width="128" height="128" rx="24" fill="currentColor" />
      <path
        fill="#0f172a"
        d="M64 18c-25.4 0-46 20.6-46 46s20.6 46 46 46c11.2 0 21.8-4 30.1-11.4l-14-16.8A23 23 0 0 1 64 85c-13 0-23.6-10.6-23.6-23.7S51 37.5 64 37.5c7.7 0 14.7 3.7 19.2 9.6l13.9-16.7C88.7 22 76.8 18 64 18Z"
      />
      <circle cx="64" cy="61.3" r="11" fill="#fff" />
    </svg>
  </div>
);

const ToggleClose = ({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => (
  <button
    onClick={() => setOpen(!open)}
    className={cn(
      "relative mt-3 flex h-11 items-center rounded-[20px] border border-slate-200/90 bg-white/88 px-2 text-slate-600 shadow-[0_8px_20px_rgba(148,163,184,0.06)] transition-colors hover:bg-slate-50 hover:text-slate-950",
      open ? "justify-start" : "justify-center",
    )}
    aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
  >
    <div className="grid h-10 w-10 place-content-center">
      <ChevronsRight className={cn("h-5 w-5 transition-transform duration-300", open && "rotate-180")} />
    </div>
    <div className={cn("overflow-hidden transition-all duration-300", open ? "w-auto opacity-100" : "w-0 opacity-0")}>
      <span className="whitespace-nowrap text-sm font-medium">Collapse Sidebar</span>
    </div>
  </button>
);

export default Sidebar;
