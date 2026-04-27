import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, Bell, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { dashboardLink, flatSidebarLinks, matchesSidebarPath, sidebarGroups } from "./Sidebar";
import type { SidebarLink } from "./Sidebar";
import { useAuth } from "@/context/AuthContext";

const pageDescriptions: Record<string, string> = {
  "/dashboard": "Overview for all clubs under Connect Camp.",
  "/login": "Authenticate to access secure areas.",
  "/clubs": "Manage rosters, onboarding, and applications.",
  "/prospects": "Run onboarding workflow for emerging clubs.",
  "/events": "Review programming across every club.",
  "/calendar": "Plan month and week scheduling across Student Life.",
  "/officers": "Track leadership and staffing changes.",
  "/approvals": "Run review workflow for clubs and events.",
  "/audit-log": "Review the operator history across approvals, staffing, settings, and workflow changes.",
  "/settings": "Adjust platform preferences and access.",
  "/support": "Get help, troubleshooting, and contact options.",
};

function Topbar() {
  const { profile, session, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const sortedLinks = [...flatSidebarLinks].sort((left, right) => right.href.length - left.href.length);
  const activeLink = sortedLinks.find((link) => matchesSidebarPath(pathname, link.href));
  const activePage = activeLink?.label ?? (pathname === "/login" ? "Login" : "Dashboard");

  const description =
    pageDescriptions[pathname] ??
    activeLink?.description ??
    "Monitor health of the Connect Camp network.";

  const displayName = profile?.full_name || profile?.email || session?.user?.email || "Connect Admin";
  const displayEmail = profile?.email || session?.user?.email || "admin@connectcamp.io";
  const avatarFallback = displayName
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Toggle navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-lg font-semibold">Connect Camp</p>
                  <p className="text-sm text-muted-foreground">Menu</p>
                </div>

                <div className="space-y-4">
                  <MobileNavSection title="Home" links={[dashboardLink]} pathname={pathname} />
                  {sidebarGroups.map((group) => (
                    <MobileNavSection
                      key={group.id}
                      title={group.label}
                      links={group.links}
                      pathname={pathname}
                    />
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <div>
            <p className="text-lg font-semibold">{activePage}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Open notifications"
          >
            <Bell className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-3 px-2 text-left"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage
                    src={profile?.avatar_url ?? undefined}
                    alt={displayName}
                  />
                  <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold leading-tight">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{displayEmail}</p>
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function MobileNavSection({
  title,
  links,
  pathname,
}: {
  title: string;
  links: SidebarLink[];
  pathname: string;
}) {
  return (
    <div className="space-y-2">
      <p className="px-3 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-1">
        {links.map(({ label, href, icon: Icon }) => (
          <SheetClose asChild key={href}>
            <NavLink
              to={href}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive || matchesSidebarPath(pathname, href)
                    ? "bg-slate-900 text-white"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          </SheetClose>
        ))}
      </div>
    </div>
  );
}

export default Topbar;
