import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import Login from "./pages/Login";
import Clubs from "./pages/Clubs";
import Events from "./pages/Events";
import CreateEvent from "./pages/CreateEvent";
import Dashboard from "./pages/Dashboard";
import ManageClubsPage from "./pages/ManageClubsPage";
import Tasks from "./pages/Tasks";
import Messaging from "./pages/Messaging";
import Officers from "./pages/Officers";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { cn } from "@/lib/utils";
import AddMembers from "./pages/AddMembers";
import { Toaster } from "@/components/ui/toaster";
import Analytics from "./pages/Analytics";
import ScrollToTop from "./components/ScrollToTop";
import FormsListPage from "./pages/forms/FormsListPage";
import FormEditorPage from "./pages/forms/FormEditorPage";
import FormResponsesPage from "./pages/forms/FormResponsesPage";
import PublicFormPage from "./pages/public/PublicFormPage";
import UserManagement from "./pages/UserManagement";
import PendingApprovals from "./pages/PendingApprovals";

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
  const location = useLocation();
  const isLoginRoute = location.pathname === "/login";
  const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarOpen);

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

  return (
    <div
      className={cn(
        "flex min-h-screen bg-muted/20",
        isLoginRoute ? "flex-col" : "flex-col md:flex-row",
      )}
    >
      {!isLoginRoute && (
        <Sidebar
          open={sidebarOpen}
          setOpen={setSidebarOpen}
          className="fixed left-0 top-0 z-20 h-screen"
        />
      )}

      <div
        className={cn(
          "flex-1 transition-all duration-300 ease-in-out",
          !isLoginRoute && (sidebarOpen ? "md:pl-64" : "md:pl-16"),
        )}
      >
        {!isLoginRoute && <Topbar />}
        <main
          className={cn(
            "h-[calc(100vh-4rem)] overflow-y-auto px-4 pb-10 pt-4 sm:px-6 lg:px-8",
            isLoginRoute &&
            "flex min-h-screen items-center justify-center bg-background px-4",
          )}
        >
          <Routes>
            <Route
              path="/"
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
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
