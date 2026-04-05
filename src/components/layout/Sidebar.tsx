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
    label: "Administration",
    hint: "Admin tools",
    icon: Settings,
    includeLogout: true,
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
  .filter((group) => group.id !== "admin")
  .flatMap((group) => group.links);
export const accountLinks: SidebarLink[] = sidebarGroups.find((group) => group.id === "admin")?.links ?? [];

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
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside className={cn("hidden md:block", className)}>
      <nav
        className={cn(
          "flex h-full flex-col border-r border-slate-200 bg-white text-slate-700 transition-all duration-200",
          open ? "w-64" : "w-20",
        )}
      >
        <div className={cn("border-b border-slate-200 px-4 py-4", !open && "px-3")}>
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

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-6">
            <NavSection open={open} label="Home" links={[dashboardLink]} />
            {sidebarGroups.map((group) => (
              <NavSection key={group.id} open={open} label={group.label} links={group.links} />
            ))}
            <NavSection open={open} label="Account" links={accountLinks} includeLogout onSignOut={handleSignOut} />
          </div>
        </div>

        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className={cn(
              "flex h-11 w-full items-center rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900",
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

function NavSection({
  open,
  label,
  links,
  includeLogout = false,
  onSignOut,
}: {
  open: boolean;
  label: string;
  links: SidebarLink[];
  includeLogout?: boolean;
  onSignOut?: () => Promise<void>;
}) {
  return (
    <section>
      {open ? (
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {label}
        </p>
      ) : null}
      <div className="space-y-1">
        {links.map((link) => (
          <NavItem key={link.href} link={link} open={open} />
        ))}
        {includeLogout && onSignOut ? <SignOutButton open={open} onClick={onSignOut} /> : null}
      </div>
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
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          !open && "justify-center px-0",
          routeActive || isActive
            ? "bg-slate-900 text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        )
      }
      title={!open ? link.label : undefined}
      aria-label={link.label}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {open ? <span className="truncate">{link.label}</span> : null}
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
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900",
        !open && "justify-center px-0",
      )}
      title={!open ? "Sign out" : undefined}
      aria-label="Sign out"
    >
      <LogOut className="h-5 w-5 shrink-0" />
      {open ? <span>Sign out</span> : null}
    </button>
  );
}

function Logo() {
  return (
    <div className="grid h-10 w-10 shrink-0 place-content-center rounded-lg bg-slate-900 text-white">
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
}

export default Sidebar;
