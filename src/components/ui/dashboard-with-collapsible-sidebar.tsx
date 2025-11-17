"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronsRight,
  DollarSign,
  HelpCircle,
  Home,
  Monitor,
  Moon,
  Package,
  Settings,
  ShoppingCart,
  Sun,
  Tag,
  TrendingUp,
  User,
  Users,
} from "lucide-react";

export const Example = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <div className={`flex min-h-screen w-full ${isDark ? "dark" : ""}`}>
      <div className="flex w-full bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <Sidebar />
        <ExampleContent isDark={isDark} setIsDark={setIsDark} />
      </div>
    </div>
  );
};

const Sidebar = () => {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState("Dashboard");

  return (
    <nav
      className={`sticky top-0 h-screen shrink-0 border-r border-gray-200 bg-white p-2 shadow-sm transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 ${
        open ? "w-64" : "w-16"
      }`}
    >
      <TitleSection open={open} />

      <div className="mb-8 space-y-1">
        <Option
          Icon={Home}
          title="Dashboard"
          selected={selected}
          setSelected={setSelected}
          open={open}
        />
        <Option
          Icon={DollarSign}
          title="Sales"
          selected={selected}
          setSelected={setSelected}
          open={open}
          notifs={3}
        />
        <Option
          Icon={Monitor}
          title="View Site"
          selected={selected}
          setSelected={setSelected}
          open={open}
        />
        <Option
          Icon={ShoppingCart}
          title="Products"
          selected={selected}
          setSelected={setSelected}
          open={open}
        />
        <Option
          Icon={Tag}
          title="Tags"
          selected={selected}
          setSelected={setSelected}
          open={open}
        />
        <Option
          Icon={BarChart3}
          title="Analytics"
          selected={selected}
          setSelected={setSelected}
          open={open}
        />
        <Option
          Icon={Users}
          title="Members"
          selected={selected}
          setSelected={setSelected}
          open={open}
          notifs={12}
        />
      </div>

      {open && (
        <div className="space-y-1 border-t border-gray-200 pt-4 dark:border-gray-800">
          <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Account
          </div>
          <Option
            Icon={Settings}
            title="Settings"
            selected={selected}
            setSelected={setSelected}
            open={open}
          />
          <Option
            Icon={HelpCircle}
            title="Help & Support"
            selected={selected}
            setSelected={setSelected}
            open={open}
          />
        </div>
      )}

      <ToggleClose open={open} setOpen={setOpen} />
    </nav>
  );
};

const Option = ({
  Icon,
  title,
  selected,
  setSelected,
  open,
  notifs,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  selected: string;
  setSelected: React.Dispatch<React.SetStateAction<string>>;
  open: boolean;
  notifs?: number;
}) => {
  const isSelected = selected === title;

  return (
    <button
      onClick={() => setSelected(title)}
      className={`relative flex h-11 w-full items-center rounded-md transition-all duration-200 ${
        isSelected
          ? "border-l-2 border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-900/50 dark:text-blue-300"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      }`}
    >
      <div className="grid h-full w-12 place-content-center">
        <Icon className="h-4 w-4" />
      </div>

      {open && (
        <span
          className={`text-sm font-medium transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        >
          {title}
        </span>
      )}

      {notifs && open && (
        <span className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-medium text-white dark:bg-blue-600">
          {notifs}
        </span>
      )}
    </button>
  );
};

const TitleSection = ({ open }: { open: boolean }) => {
  return (
    <div className="mb-6 border-b border-gray-200 pb-4 dark:border-gray-800">
      <div className="flex cursor-pointer items-center justify-between rounded-md p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
        <div className="flex items-center gap-3">
          <Logo />
          {open && (
            <div className={`transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}>
              <div className="flex items-center gap-2">
                <div>
                  <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                    TomIsLoading
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    Pro Plan
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        {open && <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
      </div>
    </div>
  );
};

const Logo = () => {
  return (
    <div className="grid size-10 shrink-0 place-content-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
      <svg
        width="20"
        height="auto"
        viewBox="0 0 50 39"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="fill-white"
      >
        <path d="M16.4992 2H37.5808L22.0816 24.9729H1L16.4992 2Z" />
        <path d="M17.4224 27.102L11.4192 36H33.5008L49 13.0271H32.7024L23.2064 27.102H17.4224Z" />
      </svg>
    </div>
  );
};

const ToggleClose = ({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  return (
    <button
      onClick={() => setOpen(!open)}
      className="absolute bottom-0 left-0 right-0 border-t border-gray-200 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
    >
      <div className="flex items-center p-3">
        <div className="grid size-10 place-content-center">
          <ChevronsRight
            className={`h-4 w-4 text-gray-500 transition-transform duration-300 dark:text-gray-400 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
        {open && (
          <span
            className={`text-sm font-medium text-gray-600 transition-opacity duration-200 dark:text-gray-300 ${
              open ? "opacity-100" : "opacity-0"
            }`}
          >
            Hide
          </span>
        )}
      </div>
    </button>
  );
};

const ExampleContent = ({
  isDark,
  setIsDark,
}: {
  isDark: boolean;
  setIsDark: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  return (
    <div className="flex-1 overflow-auto bg-gray-50 p-6 dark:bg-gray-950">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Welcome back to your dashboard
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
            <Bell className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500" />
          </button>
          <button
            onClick={() => setIsDark(!isDark)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Total Sales",
            value: "$24,567",
            delta: "+12% from last month",
            icon: DollarSign,
            accent: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
          },
          {
            title: "Active Users",
            value: "1,234",
            delta: "+5% from last week",
            icon: Users,
            accent: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
          },
          {
            title: "Orders",
            value: "456",
            delta: "+8% from yesterday",
            icon: ShoppingCart,
            accent: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
          },
          {
            title: "Products",
            value: "89",
            delta: "+3 new this week",
            icon: Package,
            accent: "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className={`rounded-lg p-2 ${item.accent}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <h3 className="mb-1 font-medium text-gray-600 dark:text-gray-400">
              {item.title}
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{item.value}</p>
            <p className="mt-1 text-sm text-green-600 dark:text-green-400">{item.delta}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Recent Activity
              </h3>
              <button className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                View all
              </button>
            </div>
            <div className="space-y-4">
              {[
                {
                  icon: DollarSign,
                  title: "New sale recorded",
                  desc: "Order #1234 completed",
                  time: "2 min ago",
                  color: "green",
                },
                {
                  icon: Users,
                  title: "New user registered",
                  desc: "john.doe@example.com joined",
                  time: "5 min ago",
                  color: "blue",
                },
                {
                  icon: Package,
                  title: "Product updated",
                  desc: "iPhone 15 Pro stock updated",
                  time: "10 min ago",
                  color: "purple",
                },
                {
                  icon: Activity,
                  title: "System maintenance",
                  desc: "Scheduled backup completed",
                  time: "1 hour ago",
                  color: "orange",
                },
                {
                  icon: Bell,
                  title: "New notification",
                  desc: "Marketing campaign results",
                  time: "2 hours ago",
                  color: "red",
                },
              ].map((activity, i) => (
                <div
                  key={i}
                  className="flex cursor-pointer items-center space-x-4 rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div
                    className={`rounded-lg p-2 ${
                      activity.color === "green"
                        ? "bg-green-50 dark:bg-green-900/20"
                        : activity.color === "blue"
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : activity.color === "purple"
                            ? "bg-purple-50 dark:bg-purple-900/20"
                            : activity.color === "orange"
                              ? "bg-orange-50 dark:bg-orange-900/20"
                              : "bg-red-50 dark:bg-red-900/20"
                    }`}
                  >
                    <activity.icon
                      className={`h-4 w-4 ${
                        activity.color === "green"
                          ? "text-green-600 dark:text-green-400"
                          : activity.color === "blue"
                            ? "text-blue-600 dark:text-blue-400"
                            : activity.color === "purple"
                              ? "text-purple-600 dark:text-purple-400"
                              : activity.color === "orange"
                                ? "text-orange-600 dark:text-orange-400"
                                : "text-red-600 dark:text-red-400"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {activity.title}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {activity.desc}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">{activity.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Quick Stats
            </h3>
            <div className="space-y-4">
              {[
                { label: "Conversion Rate", value: "3.2%", width: 32, color: "bg-blue-500" },
                { label: "Bounce Rate", value: "45%", width: 45, color: "bg-orange-500" },
                { label: "Page Views", value: "8.7k", width: 87, color: "bg-green-500" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {stat.value}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                    <div className={`h-2 rounded-full ${stat.color}`} style={{ width: `${stat.width}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Top Products
            </h3>
            <div className="space-y-3">
              {["iPhone 15 Pro", "MacBook Air M2", "AirPods Pro", "iPad Air"].map((product) => (
                <div key={product} className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{product}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    ${Math.floor(Math.random() * 1000 + 500)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Example;
