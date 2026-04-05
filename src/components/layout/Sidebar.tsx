import { useMemo } from "react";
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
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  href: "/",
  icon: Home,
  description: "Start here for a simple overview of what needs attention today.",
};

export const sidebarGroups: SidebarGroup[] = [
  {
    id: "daily-work",
    label: "Daily work",
    hint: "The most common tasks staff handle during the day.",
    icon: ClipboardCheck,
    links: [
      {
        label: "Approvals",
        href: "/approvals",
        icon: ClipboardCheck,
        description: "Review requests, approvals, and anything waiting on a decision.",
      },
      {
        label: "Messaging",
        href: "/messaging",
        icon: MessageSquare,
        description: "Send updates and keep conversations with officers in one place.",
      },
      {
        label: "Tasks",
        href: "/tasks",
        icon: ClipboardList,
        description: "Track follow-ups, assignments, and operational to-dos.",
      },
    ],
  },
  {
    id: "clubs-people",
    label: "Clubs and people",
    hint: "Everything related to clubs, officers, members, and access.",
    icon: Users,
    links: [
      {
        label: "Clubs",
        href: "/clubs",
        icon: Building2,
        description: "Manage club records, status, and organization details.",
      },
      {
        label: "Prospects",
        href: "/prospects",
        icon: Lightbulb,
        description: "Track new or emerging groups that may become active clubs.",
      },
      {
        label: "Officers",
        href: "/officers",
        icon: Users,
        description: "View and update leadership roles across organizations.",
      },
      {
        label: "Add Members",
        href: "/members/add",
        icon: UserPlus,
        description: "Quickly add people to the right club or workspace.",
      },
      {
        label: "User Management",
        href: "/users",
        icon: UserCog,
        description: "Control administrator access, roles, and account permissions.",
      },
    ],
  },
  {
    id: "planning",
    label: "Events and planning",
    hint: "Scheduling, forms, and event-related work.",
    icon: CalendarDays,
    links: [
      {
        label: "Events",
        href: "/events",
        icon: CalendarDays,
        description: "Review upcoming events and manage programming activity.",
      },
      {
        label: "Calendar",
        href: "/calendar",
        icon: CalendarRange,
        description: "See schedules in a calendar view for easier planning.",
      },
      {
        label: "Forms",
        href: "/forms",
        icon: ClipboardList,
        description: "Create forms, share them, and review responses.",
      },
    ],
  },
  {
    id: "reports",
    label: "Reports and history",
    hint: "Numbers, trends, and records of what happened.",
    icon: BarChart3,
    links: [
      {
        label: "Analytics",
        href: "/analytics",
        icon: BarChart3,
        description: "View trends and reporting across the workspace.",
      },
      {
        label: "Audit Log",
        href: "/audit-log",
        icon: History,
        description: "See a record of changes, approvals, and admin actions.",
      },
    ],
  },
  {
    id: "settings-help",
    label: "Settings and help",
    hint: "Workspace preferences, help guides, and sign out.",
    icon: Settings,
    includeLogout: true,
    links: [
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Adjust workspace options and default preferences.",
      },
      {
        label: "Support",
        href: "/support",
        icon: HelpCircle,
        description: "Open guides and support resources when you need help.",
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
  .filter((group) => group.id !== "settings-help")
  .flatMap((group) => group.links);
export const accountLinks: SidebarLink[] = sidebarGroups
  .find((group) => group.id === "settings-help")
  ?.links ?? [];

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

  const activeGroupId = useMemo(
    () =>
      sidebarGroups.find((group) =>
        group.links.some((link) => matchesSidebarPath(location.pathname, link.href)),
      )?.id,
    [location.pathname],
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside className={cn("hidden md:block", className)}>
      <nav
        className={cn(
          "relative flex h-full flex-col overflow-hidden border-r border-[#d7dfd6] bg-[linear-gradient(180deg,#fbf8f1_0%,#f4efe4_100%)] p-3 text-slate-700 shadow-[14px_0_40px_rgba(100,116,139,0.08)] transition-all duration-300 ease-in-out",
          open ? "w-72" : "w-20",
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.8),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(211,226,202,0.26),transparent_28%)]" />
        <TitleSection open={open} />

        {open ? (
          <div className="relative mb-4 rounded-[24px] border border-[#d8e4d4] bg-white/80 px-4 py-4 shadow-[0_10px_30px_rgba(148,163,184,0.08)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#69806c]">Main menu</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Choose the section that matches the task.</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              The navigation is grouped in plain language so staff can find tools quickly without knowing the system.
            </p>
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-3">
            <SectionCard open={open}>
              {open ? <SectionLabel label="Home" /> : null}
              <Option
                Icon={dashboardLink.icon}
                title={dashboardLink.label}
                description={dashboardLink.description}
                href={dashboardLink.href}
                open={open}
              />
            </SectionCard>

            {sidebarGroups.map((group) => (
              <SidebarGroupSection
                key={group.id}
                group={group}
                open={open}
                isActive={activeGroupId === group.id}
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
  isActive,
  onSignOut,
}: {
  group: SidebarGroup;
  open: boolean;
  isActive: boolean;
  onSignOut: () => Promise<void>;
}) {
  const GroupIcon = group.icon;

  if (!open) {
    return (
      <SectionCard open={open}>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "group flex h-11 w-full items-center justify-center rounded-2xl border transition-all duration-200",
                isActive
                  ? "border-[#90ad8d] bg-[#58745c] text-white shadow-[0_12px_24px_rgba(88,116,92,0.24)]"
                  : "border-transparent text-slate-600 hover:border-[#d7dfd6] hover:bg-white/90 hover:text-slate-950",
              )}
              title={group.label}
              aria-label={group.label}
            >
              <GroupIcon className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-72 rounded-[22px] border-[#d7dfd6] bg-[#fffdf9] p-3">
            <div className="mb-2 flex items-start gap-3 px-2 py-1">
              <div className="grid h-10 w-10 shrink-0 place-content-center rounded-2xl bg-[#edf3ea] text-[#4e6751]">
                <GroupIcon className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">{group.label}</p>
                <p className="text-xs leading-5 text-slate-500">{group.hint}</p>
              </div>
            </div>
            <div className="space-y-1">
              {group.links.map((link) => (
                <Option
                  key={link.href}
                  Icon={link.icon}
                  title={link.label}
                  description={link.description}
                  href={link.href}
                  open
                />
              ))}
              {group.includeLogout ? <SignOutButton open onClick={onSignOut} /> : null}
            </div>
          </PopoverContent>
        </Popover>
      </SectionCard>
    );
  }

  return (
    <SectionCard open={open} active={isActive}>
      <div className="mb-2 px-1">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid h-10 w-10 shrink-0 place-content-center rounded-2xl transition-colors",
              isActive ? "bg-[#e2ecdf] text-[#4e6751]" : "bg-[#eff4eb] text-[#657c67]",
            )}
          >
            <GroupIcon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{group.label}</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">{group.hint}</p>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {group.links.map((link) => (
          <Option
            key={link.href}
            Icon={link.icon}
            title={link.label}
            description={link.description}
            href={link.href}
            open={open}
          />
        ))}
        {group.includeLogout ? <SignOutButton open={open} onClick={onSignOut} /> : null}
      </div>
    </SectionCard>
  );
}

function Option({
  Icon,
  title,
  description,
  href,
  open,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
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
          "group relative flex w-full items-start gap-3 rounded-2xl border px-3 py-3 transition-all duration-200",
          !open && "h-11 justify-center px-0 py-0",
          isPathActive
            ? "border-[#cddfc7] bg-[#edf5e9] text-slate-950 shadow-[0_10px_22px_rgba(148,163,184,0.08)]"
            : "border-transparent text-slate-700 hover:border-[#d7dfd6] hover:bg-white/92 hover:text-slate-950",
        );
      }}
      title={!open ? title : undefined}
      aria-label={title}
    >
      <div
        className={cn(
          "grid shrink-0 place-content-center rounded-2xl transition-colors duration-200",
          open ? "h-10 w-10" : "h-11 w-11",
          matchesSidebarPath(location.pathname, href)
            ? "bg-[#58745c] text-white"
            : "bg-[#f3f1ea] text-[#667565] group-hover:bg-[#edf3ea]",
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 overflow-hidden transition-all duration-300",
          open ? "opacity-100" : "w-0 opacity-0",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-sm font-semibold">{title}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
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
        "group relative flex w-full items-start gap-3 rounded-2xl border border-transparent px-3 py-3 text-slate-600 transition-all duration-200 hover:border-[#ecd5d5] hover:bg-[#fff3f1] hover:text-[#8a3d3a]",
        !open && "h-11 justify-center px-0 py-0",
      )}
      title={!open ? "Logout" : undefined}
      aria-label="Logout"
    >
      <div
        className={cn(
          "grid shrink-0 place-content-center rounded-2xl bg-[#f7efe9] text-[#9a5f52] transition-colors duration-200",
          open ? "h-10 w-10" : "h-11 w-11",
        )}
      >
        <LogOut className="h-5 w-5" />
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 overflow-hidden text-left transition-all duration-300",
          open ? "opacity-100" : "w-0 opacity-0",
        )}
      >
        <span className="whitespace-nowrap text-sm font-semibold">Sign out</span>
        <p className="mt-1 text-xs leading-5 text-slate-500">Return to the login screen.</p>
      </div>
    </button>
  );
}

function SectionCard({
  open,
  active = false,
  children,
}: {
  open: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border bg-white/76 p-2 shadow-[0_8px_20px_rgba(148,163,184,0.05)]",
        active ? "border-[#cddfc7]" : "border-[#dde4d6]",
        !open && "px-2",
      )}
    >
      {children}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#69806c]">
      {label}
    </div>
  );
}

const TitleSection = ({ open }: { open: boolean }) => {
  return (
    <div className={cn("relative px-1", open ? "mb-4" : "mb-3")}>
      <div
        className={cn(
          "flex items-center gap-3 overflow-hidden rounded-[24px] border border-[#d9e2d5] bg-white/88 px-3 py-3 shadow-[0_10px_24px_rgba(148,163,184,0.06)]",
          !open && "justify-center px-2",
        )}
      >
        <Logo />
        <div className={cn("flex flex-col transition-all duration-300", open ? "opacity-100" : "w-0 opacity-0")}>
          <span className="whitespace-nowrap text-base font-bold tracking-tight text-slate-950">Connect Camp</span>
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.24em] text-[#69806c]">
            Admin Portal
          </span>
        </div>
      </div>
    </div>
  );
};

const Logo = () => (
  <div className="grid size-10 shrink-0 place-content-center rounded-[18px] bg-[linear-gradient(145deg,#4d6a52_0%,#65876a_55%,#83a686_100%)] text-white shadow-[0_10px_20px_rgba(77,106,82,0.22)] ring-1 ring-white/80">
    <svg viewBox="0 0 128 128" className="h-5 w-5" aria-hidden="true" focusable="false">
      <rect width="128" height="128" rx="24" fill="currentColor" />
      <path
        fill="#36503a"
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
      "relative mt-3 flex h-12 items-center rounded-[22px] border border-[#d9e2d5] bg-white/88 px-2 text-slate-700 shadow-[0_8px_20px_rgba(148,163,184,0.06)] transition-colors hover:bg-white hover:text-slate-950",
      open ? "justify-start" : "justify-center",
    )}
    aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
  >
    <div className="grid h-10 w-10 place-content-center">
      <ChevronsRight className={cn("h-5 w-5 transition-transform duration-300", open && "rotate-180")} />
    </div>
    <div className={cn("overflow-hidden transition-all duration-300", open ? "w-auto opacity-100" : "w-0 opacity-0")}>
      <span className="whitespace-nowrap text-sm font-medium">Collapse menu</span>
    </div>
  </button>
);

export default Sidebar;
