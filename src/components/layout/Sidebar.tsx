import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import BrandLogo from "./BrandLogo";
import SidebarWidget from "./SidebarWidget";
import {
  matchesSidebarExactPath,
  matchesSidebarPath,
  sidebarSections,
  type SidebarItem,
  type SidebarSection,
} from "./sidebarData";

type SidebarProps = {
  open: boolean;
  mobileOpen: boolean;
  hovered: boolean;
  setHovered: Dispatch<SetStateAction<boolean>>;
  className?: string;
};

type OpenSubmenu = {
  type: "main" | "others";
  index: number;
} | null;

function getInitialOpenSubmenu(pathname: string): OpenSubmenu {
  for (const [sectionIndex, section] of sidebarSections.entries()) {
    for (const [itemIndex, item] of section.items.entries()) {
      if (item.subItems?.some((subItem) => matchesSidebarPath(pathname, subItem.href))) {
        return {
          type: sectionIndex === 0 ? "main" : "others",
          index: itemIndex,
        };
      }
    }
  }

  return null;
}

function SidebarItemIcon({ item, active }: { item: SidebarItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <span
      className={cn(
        active ? "menu-item-icon-active" : "menu-item-icon-inactive",
      )}
    >
      <Icon size={20} />
    </span>
  );
}

function SidebarSectionLabel({
  section,
  compact,
}: {
  section: SidebarSection;
  compact: boolean;
}) {
  return (
    <h2
      className={cn(
        "mb-3 flex text-xs uppercase leading-[20px] text-gray-400",
        compact ? "lg:justify-center" : "justify-start",
      )}
    >
      {compact ? <MoreHorizontal size={18} /> : section.label}
    </h2>
  );
}

export default function Sidebar({
  open,
  mobileOpen,
  hovered,
  setHovered,
  className,
}: SidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const isCompactDesktopSidebar = !open && !hovered;

  const [openSubmenu, setOpenSubmenu] = useState<OpenSubmenu>(() =>
    getInitialOpenSubmenu(pathname),
  );
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => matchesSidebarExactPath(pathname, path), [pathname]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  const renderMenuItems = (items: SidebarItem[], menuType: "main" | "others") => (
    <ul className="flex flex-col gap-3">
      {items.map((nav, index) => (
        <li key={nav.label}>
          {nav.subItems ? (
            <button
              type="button"
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !open && !hovered ? "lg:justify-center" : "lg:justify-start"
              }`}
            >
              <SidebarItemIcon
                item={nav}
                active={openSubmenu?.type === menuType && openSubmenu?.index === index}
              />
              {(open || hovered || mobileOpen) && (
                <span className="menu-item-text">{nav.label}</span>
              )}
              {(open || hovered || mobileOpen) && (
                <ChevronDown
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType && openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <NavLink
                to={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <SidebarItemIcon item={nav} active={isActive(nav.path)} />
                {(open || hovered || mobileOpen) && (
                  <span className="menu-item-text">{nav.label}</span>
                )}
              </NavLink>
            )
          )}
          {nav.subItems && (open || hovered || mobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.href}>
                    <NavLink
                      to={subItem.href}
                      className={`menu-dropdown-item ${
                        isActive(subItem.href)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {subItem.label}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.href)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.href)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={cn(
        `fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200`,
        open || mobileOpen ? "w-[290px]" : hovered ? "w-[290px]" : "w-[90px]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0",
        className,
      )}
      onMouseEnter={() => !open && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={cn(
          "flex",
          mobileOpen ? "py-4" : "py-8",
          !open && !hovered ? "lg:justify-center" : "justify-start",
        )}
      >
        {!mobileOpen && <BrandLogo compact={isCompactDesktopSidebar} />}
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-4 flex-1">
          <div className="flex flex-col gap-3">
            <div>
              <SidebarSectionLabel
                section={sidebarSections[0]}
                compact={isCompactDesktopSidebar && !mobileOpen}
              />
              {renderMenuItems(sidebarSections[0].items, "main")}
            </div>
            <div>
              <SidebarSectionLabel
                section={sidebarSections[1]}
                compact={isCompactDesktopSidebar && !mobileOpen}
              />
              {renderMenuItems(sidebarSections[1].items, "others")}
            </div>
          </div>
        </nav>
        <SidebarWidget compact={isCompactDesktopSidebar || mobileOpen} />
      </div>
    </aside>
  );
}
