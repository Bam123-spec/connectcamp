import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Clubs from "./pages/Clubs";
import Events from "./pages/Events";
import Officers from "./pages/Officers";
import Settings from "./pages/Settings";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { cn } from "@/lib/utils";

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

function AppLayout() {
  const location = useLocation();
  const isLoginRoute = location.pathname === "/login";

  return (
    <div
      className={cn(
        "flex min-h-screen bg-muted/20",
        isLoginRoute ? "flex-col" : "flex-col md:flex-row",
      )}
    >
      {!isLoginRoute && <Sidebar />}

      <div className="flex-1">
        {!isLoginRoute && <Topbar />}
        <main
          className={cn(
            "px-4 pb-10 pt-4 sm:px-6 lg:px-8",
            isLoginRoute && "flex min-h-screen items-center justify-center bg-background px-4",
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
              path="/events"
              element={
                <ProtectedRoute>
                  <Events />
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
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
