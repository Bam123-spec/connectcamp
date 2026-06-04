import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, matchPath, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Clubs from "./pages/Clubs";
import Events from "./pages/Events";
import CalendarPage from "./pages/Calendar";
import CreateEvent from "./pages/CreateEvent";
import Dashboard from "./pages/Dashboard";
import ManageClubsPage from "./pages/ManageClubsPage";
import Tasks from "./pages/Tasks";
import Messaging from "./pages/Messaging";
import Officers from "./pages/Officers";
import Prospects from "./pages/Prospects";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import Backdrop from "./components/layout/Backdrop";
import ProtectedRoute from "./components/ProtectedRoute";
import { cn } from "@/lib/utils";
import AddMembers from "./pages/AddMembers";
import { Toaster } from "@/components/ui/toaster";
import Analytics from "./pages/Analytics";
import ScrollToTop from "./components/ScrollToTop";
import { useAuth } from "./context/AuthContext";
import FormsListPage from "./pages/forms/FormsListPage";
import FormEditorPage from "./pages/forms/FormEditorPage";
import FormResponsesPage from "./pages/forms/FormResponsesPage";
import PublicFormPage from "./pages/public/PublicFormPage";
import UserManagement from "./pages/UserManagement";
import PendingApprovals from "./pages/PendingApprovals";
import AuditLog from "./pages/AuditLog";

const SIDEBAR_COMPACT_STORAGE_KEY = "cc.sidebar.compact.default";

const getInitialSidebarOpen = () => {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SIDEBAR_COMPACT_STORAGE_KEY) !== "true";
};

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppLayout />
      <Toaster />
    </BrowserRouter>
  );
}

function AppLayout() {
  const { session, profile } = useAuth();
  const location = useLocation();
  const isLoginRoute = location.pathname === "/login";
  const isLandingRoute = location.pathname === "/";
  const isPublicFormRoute = Boolean(
    matchPath("/form-fill/:formId", location.pathname),
  );
  const isAuthenticatedAdmin = Boolean(session && profile?.role === "admin");
  const showAppChrome = !isLoginRoute && !isLandingRoute && !isPublicFormRoute && isAuthenticatedAdmin;
  const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarOpen);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const applySidebarPreference = () => {
      setSidebarOpen(getInitialSidebarOpen());
    };

    window.addEventListener("storage", applySidebarPreference);
    window.addEventListener("cc:settings-updated", applySidebarPreference);

    return () => {
      window.removeEventListener("storage", applySidebarPreference);
      window.removeEventListener("cc:settings-updated", applySidebarPreference);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !showAppChrome) return;
    window.localStorage.setItem(
      SIDEBAR_COMPACT_STORAGE_KEY,
      sidebarOpen ? "false" : "true",
    );
  }, [showAppChrome, sidebarOpen]);

  return (
    <div className={cn("min-h-screen", showAppChrome ? "xl:flex" : "flex flex-col")}>
      {showAppChrome && (
        <Sidebar
          key={location.pathname}
          open={sidebarOpen}
          mobileOpen={mobileSidebarOpen}
          hovered={sidebarHovered}
          setHovered={setSidebarHovered}
        />
      )}
      {showAppChrome && (
        <Backdrop
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          "flex-1 transition-all duration-300 ease-in-out",
          showAppChrome &&
            (mobileSidebarOpen
              ? "ml-0"
              : sidebarOpen || sidebarHovered
                ? "lg:ml-[290px]"
                : "lg:ml-[90px]"),
        )}
      >
        {showAppChrome && (
          <Topbar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            mobileOpen={mobileSidebarOpen}
            setMobileOpen={setMobileSidebarOpen}
          />
        )}
        <main
          className={cn(
            "overflow-y-auto",
            showAppChrome && "p-4 mx-auto max-w-screen-2xl md:p-6",
            isLoginRoute &&
              "flex min-h-screen items-center justify-center bg-background px-4",
            isPublicFormRoute && "min-h-screen",
          )}
        >
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route
              path="/clubs"
              element={
                <ProtectedRoute>
                  <Clubs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clubs/manage"
              element={
                <ProtectedRoute>
                  <ManageClubsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/members/add"
              element={
                <ProtectedRoute>
                  <AddMembers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/events"
              element={
                <ProtectedRoute>
                  <Events />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <CalendarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/prospects"
              element={
                <ProtectedRoute>
                  <Prospects />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forms"
              element={
                <ProtectedRoute>
                  <FormsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forms/create"
              element={
                <ProtectedRoute>
                  <FormEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forms/:formId/edit"
              element={
                <ProtectedRoute>
                  <FormEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forms/:formId/responses"
              element={
                <ProtectedRoute>
                  <FormResponsesPage />
                </ProtectedRoute>
              }
            />
            <Route path="/form-fill/:formId" element={<PublicFormPage />} />
            <Route
              path="/events/create"
              element={
                <ProtectedRoute>
                  <CreateEvent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <Tasks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messaging"
              element={
                <ProtectedRoute>
                  <Messaging />
                </ProtectedRoute>
              }
            />
            <Route
              path="/officers"
              element={
                <ProtectedRoute>
                  <Officers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/support"
              element={
                <ProtectedRoute>
                  <Support />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/approvals"
              element={
                <ProtectedRoute>
                  <PendingApprovals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-log"
              element={
                <ProtectedRoute>
                  <AuditLog />
                </ProtectedRoute>
              }
            />
            <Route
              path="*"
              element={<Navigate to={isAuthenticatedAdmin ? "/" : "/login"} replace />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
