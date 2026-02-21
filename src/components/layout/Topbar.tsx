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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { primaryLinks, manageLinks, accountLinks } from "./Sidebar";
import type { SidebarLink } from "./Sidebar";
import { useAuth } from "@/context/AuthContext";

const pageDescriptions: Record<string, string> = {
  "/": "Overview for all clubs under Connect Camp.",
  "/login": "Authenticate to access secure areas.",
  "/clubs": "Manage rosters, onboarding, and applications.",
  "/events": "Review programming across every club.",
  "/officers": "Track leadership and staffing changes.",
  "/settings": "Adjust platform preferences and access.",
  "/support": "Get help, troubleshooting, and contact options.",
};

function Topbar() {
  const { profile, session, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const allLinks = [...primaryLinks, ...manageLinks, ...accountLinks];
  const activePage =
    allLinks.find((link) => {
      if (link.href === "/") return pathname === "/";
      return pathname.startsWith(link.href);
    })?.label ??
    (pathname === "/login" ? "Login" : "Dashboard");

  const description =
    pageDescriptions[pathname] ?? "Monitor health of the Connect Camp network.";

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
                  <p className="text-sm text-muted-foreground">Quick navigation</p>
                </div>
                <div className="flex flex-col gap-2">
                  {[...primaryLinks, ...manageLinks, ...accountLinks].map(({ label, href, icon: Icon }: SidebarLink) => (
                    <NavLink
                      key={href}
                      to={href}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )
                      }
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </NavLink>
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

export default Topbar;
