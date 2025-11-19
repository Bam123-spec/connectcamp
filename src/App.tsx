import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Clubs from "./pages/Clubs";
import Events from "./pages/Events";
import CreateEvent from "./pages/CreateEvent";
import Tasks from "./pages/Tasks";
import Messaging from "./pages/Messaging";
import Officers from "./pages/Officers";
import Settings from "./pages/Settings";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { cn } from "@/lib/utils";
import AddMembers from "./pages/AddMembers";
import { Toaster } from "@/components/ui/toaster";
import Analytics from "./pages/Analytics";
import FormsHome from "./forms/FormsHome";
import CreateForm from "./forms/CreateForm";
import FormDetail from "./forms/FormDetail";
import FormSubmissions from "./forms/FormSubmissions";
import PublicFormFill from "./forms/PublicFormFill";

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
      <Toaster />
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
                  <FormsHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forms/create"
              element={
                <ProtectedRoute>
                  <CreateForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forms/:formId"
              element={
                <ProtectedRoute>
                  <FormDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forms/:formId/submissions"
              element={
                <ProtectedRoute>
                  <FormSubmissions />
                </ProtectedRoute>
              }
            />
            <Route path="/form-fill/:formId" element={<PublicFormFill />} />
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
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
