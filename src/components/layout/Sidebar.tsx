import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  CalendarDays,
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
  BarChart3,
  ClipboardList,
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
  { label: "Events", href: "/events", icon: CalendarDays },
];

export const manageLinks: SidebarLink[] = [
  { label: "Add Members", href: "/members/add", icon: UserPlus },
  { label: "User Management", href: "/users", icon: UserCog },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Forms", href: "/forms", icon: ClipboardList },
  { label: "Pending Approvals", href: "/approvals", icon: ClipboardCheck },
  { label: "Tasks", href: "/tasks", icon: ClipboardList },
  { label: "Messaging", href: "/messaging", icon: MessageSquare },
  { label: "Officers", href: "/officers", icon: Users },
];

const accountLinks: SidebarLink[] = [
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Support", href: "/settings", icon: HelpCircle },
];

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
    <aside className={cn("hidden bg-[#18181b] md:block", className)}>
      <nav
        className={cn(
          "flex h-full flex-col overflow-hidden border-r border-zinc-800 bg-[#18181b] p-3 text-zinc-400 shadow-xl transition-all duration-300 ease-in-out",
          open ? "w-64" : "w-20",
        )}
      >
        <TitleSection open={open} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mb-4 space-y-1">
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

          <div className="space-y-6 border-t border-zinc-800 pt-6">
            <div>
              {open && (
                <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
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

            <div>
              {open && (
                <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
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
                    "group relative flex h-10 w-full items-center rounded-md px-3 text-zinc-400 transition-all duration-200 hover:bg-white/5 hover:text-zinc-100",
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
        // Custom active logic for nested routes
        const isPathActive = isActive || (href !== "/" && location.pathname.startsWith(href));

        return cn(
          "group relative flex h-10 w-full items-center rounded-md px-3 transition-all duration-200",
          !open && "justify-center px-0",
          isPathActive
            ? "bg-white/10 text-white shadow-sm"
            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
        );
      }}
      title={!open ? title : undefined}
      aria-label={title}
    >
      <div className="flex items-center justify-center">
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
    <div className="mb-8 px-1">
      <div className="flex items-center gap-3 overflow-hidden">
        <Logo />
        <div className={cn("flex flex-col transition-all duration-300", open ? "opacity-100" : "opacity-0 w-0")}>
          <span className="text-base font-bold text-white tracking-tight whitespace-nowrap">
            Connect Camp
          </span>
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">
            Admin Workspace
          </span>
        </div>
      </div>
    </div>
  );
};

const Logo = () => (
  <div className="grid size-9 shrink-0 place-content-center rounded-lg bg-white text-black shadow-sm ring-1 ring-white/20">
    <svg
      viewBox="0 0 128 128"
      className="h-5 w-5"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="128" height="128" rx="24" fill="currentColor" />
      <path
        fill="#000"
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
      "mt-3 flex h-11 items-center rounded-md border-t border-zinc-800 pt-3 text-zinc-500 transition-colors hover:text-zinc-300",
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
