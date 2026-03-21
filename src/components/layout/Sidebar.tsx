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
};

export const primaryLinks: SidebarLink[] = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Clubs", href: "/clubs", icon: Building2 },
  { label: "Prospects", href: "/prospects", icon: Lightbulb },
  { label: "Events", href: "/events", icon: CalendarDays },
  { label: "Calendar", href: "/calendar", icon: CalendarRange },
];

export const manageLinks: SidebarLink[] = [
  { label: "Add Members", href: "/members/add", icon: UserPlus },
  { label: "User Management", href: "/users", icon: UserCog },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Forms", href: "/forms", icon: ClipboardList },
  { label: "Approvals", href: "/approvals", icon: ClipboardCheck },
  { label: "Audit Log", href: "/audit-log", icon: History },
  { label: "Tasks", href: "/tasks", icon: ClipboardList },
  { label: "Messaging", href: "/messaging", icon: MessageSquare },
  { label: "Officers", href: "/officers", icon: Users },
];

export const accountLinks: SidebarLink[] = [
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Support", href: "/support", icon: HelpCircle },
];

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
          "relative flex h-full flex-col overflow-hidden border-r border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#f2f7fc_100%)] p-3 text-slate-600 shadow-[10px_0_30px_rgba(148,163,184,0.08)] transition-all duration-300 ease-in-out",
          open ? "w-64" : "w-20",
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.28),transparent_24%)]" />
        <TitleSection open={open} />
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <div className="mb-4 rounded-[22px] border border-slate-200/90 bg-white/80 p-2 shadow-[0_8px_20px_rgba(148,163,184,0.05)]">
            {open && (
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Workspace
              </div>
            )}
            <div className="space-y-1">
              {primaryLinks.map((link) => (
                <Option
                  key={link.href}
                  Icon={link.icon}
                  title={link.label}
                  href={link.href}
                  open={open}
                />
              ))}
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-200/80 pt-4">
            <div className="rounded-[22px] border border-slate-200/90 bg-white/80 p-2 shadow-[0_8px_20px_rgba(148,163,184,0.05)]">
              {open && (
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  Manage
                </div>
              )}
              <div className="space-y-1">
                {manageLinks.map((link) => (
                  <Option
                    key={link.href}
                    Icon={link.icon}
                    title={link.label}
                    href={link.href}
                    open={open}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[22px] border border-slate-200/90 bg-white/80 p-2 shadow-[0_8px_20px_rgba(148,163,184,0.05)]">
              {open && (
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  Account
                </div>
              )}
              <div className="space-y-1">
                {accountLinks.map((link) => (
                  <Option
                    key={link.href}
                    Icon={link.icon}
                    title={link.label}
                    href={link.href}
                    open={open}
                  />
                ))}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={cn(
                    "group relative flex h-10 w-full items-center rounded-2xl px-3 text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-950",
                    !open && "justify-center px-0",
                  )}
                  title={!open ? "Logout" : undefined}
                  aria-label="Logout"
                >
                  <LogOut className="h-5 w-5" />
                  <div
                    className={cn(
                      "flex flex-1 items-center overflow-hidden transition-all duration-300",
                      open ? "ml-3 opacity-100" : "ml-0 w-0 opacity-0",
                    )}
                  >
                    <span className="whitespace-nowrap text-sm font-medium">
                      Logout
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <ToggleClose open={open} setOpen={setOpen} />
      </nav>
    </aside>
  );
}

const Option = ({
  Icon,
  title,
  href,
  open,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  href: string;
  open: boolean;
}) => {
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
      <div className={cn(
        "flex items-center justify-center rounded-xl transition-colors duration-200",
        open ? "h-8 w-8" : "h-10 w-10",
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className={cn("flex flex-1 items-center overflow-hidden transition-all duration-300", open ? "ml-3 opacity-100" : "w-0 ml-0 opacity-0")}>
        <span className="text-sm font-medium whitespace-nowrap">
          {title}
        </span>
      </div>
    </NavLink>
  );
};

const TitleSection = ({ open }: { open: boolean }) => {
  return (
    <div className={cn("relative px-1", open ? "mb-5" : "mb-4")}>
      <div className={cn(
        "flex items-center gap-3 overflow-hidden rounded-[24px] border border-slate-200/90 bg-white/88 px-3 py-3 shadow-[0_10px_24px_rgba(148,163,184,0.06)]",
        !open && "justify-center px-2",
      )}>
        <Logo />
        <div className={cn("flex flex-col transition-all duration-300", open ? "opacity-100" : "opacity-0 w-0")}>
          <span className="text-base font-bold text-slate-950 tracking-tight whitespace-nowrap">
            Connect Camp
          </span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.24em] whitespace-nowrap">
            Admin Workspace
          </span>
        </div>
      </div>
    </div>
  );
};

const Logo = () => (
  <div className="grid size-10 shrink-0 place-content-center rounded-[18px] bg-[linear-gradient(145deg,#0f172a_0%,#1e293b_62%,#334155_100%)] text-white shadow-[0_10px_20px_rgba(15,23,42,0.16)] ring-1 ring-white/80">
    <svg
      viewBox="0 0 128 128"
      className="h-5 w-5"
      aria-hidden="true"
      focusable="false"
    >
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
      <ChevronsRight
        className={cn(
          "h-5 w-5 transition-transform duration-300",
          open && "rotate-180",
        )}
      />
    </div>
    <div className={cn("overflow-hidden transition-all duration-300", open ? "w-auto opacity-100" : "w-0 opacity-0")}>
      <span className="text-sm font-medium whitespace-nowrap">Collapse Sidebar</span>
    </div>
  </button>
);

export default Sidebar;
