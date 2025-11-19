import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  CalendarDays,
  Users,
  Settings,
  Building2,
  LogOut,
  HelpCircle,
  ChevronsRight,
  ChevronDown,
  ClipboardCheck,
  MessageSquare,
  UserPlus,
  BarChart3,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Forms", href: "/forms", icon: ClipboardList },
  { label: "Tasks", href: "/tasks", icon: ClipboardCheck },
  { label: "Messaging", href: "/messaging", icon: MessageSquare },
  { label: "Officers", href: "/officers", icon: Users },
];

const accountLinks: SidebarLink[] = [
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Support", href: "/settings", icon: HelpCircle },
  { label: "Logout", href: "/login", icon: LogOut },
];

interface SidebarProps {
  className?: string;
}

function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState(primaryLinks[0].label);

  useEffect(() => {
    const allLinks = [...primaryLinks, ...manageLinks, ...accountLinks];
    const active = allLinks.find((link) => link.href === location.pathname)?.label ?? primaryLinks[0].label;
    setSelected(active);
  }, [location.pathname]);

  return (
    <aside className={cn("hidden md:block", className)}>
      <nav
        className={cn(
          "sticky top-0 flex h-screen flex-col border-r border-gray-200 bg-white p-2 text-gray-700 shadow-sm transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100",
          open ? "w-64" : "w-16",
        )}
      >
        <TitleSection open={open} />

        <div className="mb-4 space-y-1">
          {primaryLinks.map((link) => (
            <Option
              key={link.href}
              Icon={link.icon}
              title={link.label}
              href={link.href}
              open={open}
              isSelected={selected === link.label}
              onSelect={() => setSelected(link.label)}
            />
          ))}
        </div>

        <div className="space-y-5 border-t border-gray-200 pt-4 dark:border-gray-800">
          <div>
            {open && (
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
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
                  isSelected={selected === link.label}
                  onSelect={() => setSelected(link.label)}
                />
              ))}
            </div>
          </div>

          <div>
            {!open && <div className="mx-2 border-t border-gray-200 dark:border-gray-800" />}
            {open && (
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
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
                  isSelected={selected === link.label}
                  onSelect={() => setSelected(link.label)}
                />
              ))}
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
  isSelected,
  onSelect,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  href: string;
  open: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) => (
  <NavLink
    to={href}
    className={({ isActive }) =>
      cn(
        "relative flex h-11 w-full items-center rounded-md transition-all duration-200",
        (isActive || isSelected)
          ? "border-l-2 border-primary bg-primary/10 text-primary"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
      )
    }
    onClick={onSelect}
  >
    <div className="grid h-full w-12 place-content-center">
      <Icon className="h-4 w-4" />
    </div>
    <div className="flex flex-1 min-w-0 items-center">
      <span
        className={cn(
          "text-sm font-medium whitespace-nowrap transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        {title}
      </span>
    </div>
  </NavLink>
);

const TitleSection = ({ open }: { open: boolean }) => {
  return (
    <div className="mb-6 border-b border-gray-200 pb-4 dark:border-gray-800">
      <div className="flex cursor-pointer items-center justify-between rounded-md p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/40">
        <div className="flex items-center gap-3">
          <Logo />
          {open && (
            <div className="transition-opacity duration-200">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Connect Camp
              </p>
              {open && (
                <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  Admin Workspace
                </p>
              )}
            </div>
          )}
        </div>
        {open && <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
      </div>
    </div>
  );
};

const Logo = () => (
  <div className="grid size-10 shrink-0 place-content-center rounded-lg bg-black text-white shadow-sm">
    <svg
      viewBox="0 0 128 128"
      className="h-7 w-7"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="128" height="128" rx="24" fill="currentColor" />
      <path
        fill="#fff"
        d="M64 18c-25.4 0-46 20.6-46 46s20.6 46 46 46c11.2 0 21.8-4 30.1-11.4l-14-16.8A23 23 0 0 1 64 85c-13 0-23.6-10.6-23.6-23.7S51 37.5 64 37.5c7.7 0 14.7 3.7 19.2 9.6l13.9-16.7C88.7 22 76.8 18 64 18Z"
      />
      <circle cx="64" cy="61.3" r="11" fill="#000" />
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
    className="mt-auto border-t border-gray-200 dark:border-gray-800"
  >
    <div className="flex items-center p-3">
      <div className="grid size-10 place-content-center">
        <ChevronsRight
          className={cn(
            "h-4 w-4 text-gray-500 transition-transform duration-300 dark:text-gray-400",
            open && "rotate-180",
          )}
        />
      </div>
      {open && (
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Hide</span>
      )}
    </div>
  </button>
);

export default Sidebar;
