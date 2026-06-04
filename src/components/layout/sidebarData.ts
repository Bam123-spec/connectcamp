import {
  BarChart3,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Home,
  Users,
  type LucideIcon,
} from "lucide-react";
import { matchPath } from "react-router-dom";

export type SidebarSubItem = {
  label: string;
  href: string;
  pro?: boolean;
  new?: boolean;
};

export type SidebarItem = {
  label: string;
  icon: LucideIcon;
  path?: string;
  subItems?: SidebarSubItem[];
};

export type SidebarSection = {
  id: string;
  label: string;
  hint: string;
  items: SidebarItem[];
};

export type SidebarPageMeta = {
  label: string;
  href: string;
  description: string;
  sectionId: string;
};

export const mainNavItems: SidebarItem[] = [
  {
    label: "Dashboard",
    icon: Home,
    subItems: [{ label: "Overview", href: "/dashboard" }],
  },
  {
    label: "Clubs",
    icon: Building2,
    subItems: [
      { label: "All Clubs", href: "/clubs" },
      { label: "Manage Clubs", href: "/clubs/manage" },
    ],
  },
  {
    label: "Events",
    icon: CalendarDays,
    subItems: [
      { label: "All Events", href: "/events" },
      { label: "Create Event", href: "/events/create" },
    ],
  },
  {
    label: "Forms",
    icon: ClipboardList,
    subItems: [
      { label: "Form Library", href: "/forms" },
      { label: "Create Form", href: "/forms/create" },
    ],
  },
  {
    label: "Calendar",
    icon: CalendarRange,
    path: "/calendar",
  },
];

export const otherNavItems: SidebarItem[] = [
  {
    label: "People",
    icon: Users,
    subItems: [
      { label: "Prospects", href: "/prospects" },
      { label: "Officers", href: "/officers" },
      { label: "Add Members", href: "/members/add" },
      { label: "User Management", href: "/users" },
    ],
  },
  {
    label: "Operations",
    icon: ClipboardCheck,
    subItems: [
      { label: "Approvals", href: "/approvals" },
      { label: "Tasks", href: "/tasks" },
      { label: "Messaging", href: "/messaging" },
      { label: "Audit Log", href: "/audit-log" },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    subItems: [
      { label: "Analytics", href: "/analytics" },
      { label: "Settings", href: "/settings" },
      { label: "Support", href: "/support" },
    ],
  },
];

export const sidebarSections: SidebarSection[] = [
  {
    id: "menu",
    label: "Menu",
    hint: "Primary workspace pages",
    items: mainNavItems,
  },
  {
    id: "others",
    label: "Others",
    hint: "Supporting tools and administration",
    items: otherNavItems,
  },
];

const pageMeta: SidebarPageMeta[] = [
  { label: "Overview", href: "/dashboard", description: "Workspace overview and important updates.", sectionId: "menu" },
  { label: "All Clubs", href: "/clubs", description: "Club records and management.", sectionId: "menu" },
  { label: "Manage Clubs", href: "/clubs/manage", description: "Detailed club workflow and status review.", sectionId: "menu" },
  { label: "All Events", href: "/events", description: "Manage events and approvals.", sectionId: "menu" },
  { label: "Create Event", href: "/events/create", description: "Draft a new event for a club or campus audience.", sectionId: "menu" },
  { label: "Form Library", href: "/forms", description: "Build forms and review responses.", sectionId: "menu" },
  { label: "Create Form", href: "/forms/create", description: "Start a new form from scratch.", sectionId: "menu" },
  { label: "Edit Form", href: "/forms/:formId/edit", description: "Update questions, rules, and form settings.", sectionId: "menu" },
  { label: "Form Responses", href: "/forms/:formId/responses", description: "Review submissions and export responses.", sectionId: "menu" },
  { label: "Calendar", href: "/calendar", description: "View schedules and availability.", sectionId: "menu" },
  { label: "Prospects", href: "/prospects", description: "Prospective clubs and outreach.", sectionId: "others" },
  { label: "Officers", href: "/officers", description: "Officer assignments and coverage.", sectionId: "others" },
  { label: "Add Members", href: "/members/add", description: "Add members quickly.", sectionId: "others" },
  { label: "User Management", href: "/users", description: "Manage user access.", sectionId: "others" },
  { label: "Approvals", href: "/approvals", description: "Review requests and pending items.", sectionId: "others" },
  { label: "Tasks", href: "/tasks", description: "Track follow-ups and assignments.", sectionId: "others" },
  { label: "Messaging", href: "/messaging", description: "Messages and conversations.", sectionId: "others" },
  { label: "Audit Log", href: "/audit-log", description: "History of admin actions.", sectionId: "others" },
  { label: "Analytics", href: "/analytics", description: "Reports and trends.", sectionId: "others" },
  { label: "Settings", href: "/settings", description: "Workspace preferences and alerts.", sectionId: "others" },
  { label: "Support", href: "/support", description: "Help, troubleshooting, and contact options.", sectionId: "others" },
];

function matchesRoute(pathname: string, href: string) {
  if (href.includes(":")) {
    return Boolean(matchPath({ path: href, end: true }, pathname));
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getSectionForHref(href: string) {
  const meta = pageMeta.find((entry) => entry.href === href || matchesRoute(entry.href, href));
  if (meta) {
    return sidebarSections.find((section) => section.id === meta.sectionId) ?? sidebarSections[0];
  }

  return sidebarSections[0];
}

function findMatchingSection(pathname: string) {
  const explicitMeta = pageMeta.find((entry) => matchesRoute(pathname, entry.href));
  if (explicitMeta) {
    return sidebarSections.find((section) => section.id === explicitMeta.sectionId) ?? sidebarSections[0];
  }

  const matchingItem = sidebarSections.find((section) =>
    section.items.some((item) => matchesSidebarItem(pathname, item)),
  );

  return matchingItem ?? sidebarSections[0];
}

function matchesSidebarItem(pathname: string, item: SidebarItem) {
  if (item.path && matchesRoute(pathname, item.path)) return true;
  return (item.subItems ?? []).some((subItem) => matchesRoute(pathname, subItem.href));
}

function findMatchingPageMeta(pathname: string) {
  return pageMeta.find((entry) => matchesRoute(pathname, entry.href));
}

export function matchesSidebarPath(pathname: string, href: string) {
  return matchesRoute(pathname, href);
}

export function matchesSidebarExactPath(pathname: string, href: string) {
  if (href.includes(":")) {
    return Boolean(matchPath({ path: href, end: true }, pathname));
  }

  return pathname === href;
}

export function getSidebarPageMeta(pathname: string) {
  const activeSection = findMatchingSection(pathname);
  const explicitMeta = findMatchingPageMeta(pathname);

  if (explicitMeta) {
    return {
      activeSection,
      activeLink: explicitMeta,
      description: explicitMeta.description,
    };
  }

  const fallbackItem =
    sidebarSections
      .flatMap((section) => section.items)
      .find((item) => matchesSidebarItem(pathname, item)) ?? mainNavItems[0];
  const fallbackSubItem = fallbackItem.subItems?.[0];

  const fallbackLink =
    fallbackItem.path
      ? {
          label: fallbackItem.label,
          href: fallbackItem.path,
          description: pageMeta.find((entry) => entry.href === fallbackItem.path)?.description ?? activeSection.hint,
        }
      : {
          label: fallbackItem.label,
          href: fallbackSubItem?.href ?? "/dashboard",
          description: fallbackSubItem
            ? pageMeta.find((entry) => entry.href === fallbackSubItem.href)?.description ?? activeSection.hint
            : activeSection.hint,
        };

  return {
    activeSection,
    activeLink: fallbackLink,
    description: fallbackLink.description,
  };
}

export function getSidebarSectionForPath(pathname: string) {
  return findMatchingSection(pathname);
}

export function isSidebarItemActive(pathname: string, item: SidebarItem) {
  return matchesSidebarItem(pathname, item);
}

export function getSidebarSubItemMeta(subItem: SidebarSubItem) {
  return {
    ...subItem,
    description: pageMeta.find((entry) => entry.href === subItem.href)?.description ?? "",
    section: getSectionForHref(subItem.href),
  };
}
