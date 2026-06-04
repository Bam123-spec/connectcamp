import { LogOut } from "lucide-react";

import { useAuth } from "@/context/AuthContext";

type SidebarWidgetProps = {
  compact: boolean;
};

export default function SidebarWidget({ compact }: SidebarWidgetProps) {
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div
      className={[
        "mt-auto mb-8 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-4 dark:border-gray-800 dark:bg-white/[0.03]",
        compact ? "px-2" : "px-3",
      ].join(" ")}
    >
      {compact ? (
        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-theme-xs transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-300"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
              Session
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
              {profile?.full_name ?? profile?.email ?? "Signed in"}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              End your session when you are done.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-theme-xs transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
