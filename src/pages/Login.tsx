import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";

import BrandLogo from "@/components/layout/BrandLogo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

function Login() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const locationState = location.state as
    | { from?: { pathname?: string }; reason?: string }
    | undefined;

  const redirectPath = useMemo(
    () => locationState?.from?.pathname ?? "/dashboard",
    [locationState?.from?.pathname],
  );

  const unauthorizedReason = locationState?.reason;

  useEffect(() => {
    if (profile?.role === "admin") {
      navigate(redirectPath, { replace: true });
    }
  }, [navigate, profile?.role, redirectPath]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setPending(false);
      return;
    }

    const user = data.user;
    const newProfile = await refreshProfile(user.id);

    if (newProfile?.role !== "admin") {
      setError("Access restricted. Please sign in with an administrator account.");
      await supabase.auth.signOut();
      setPending(false);
      return;
    }

    setPending(false);
    navigate(redirectPath, { replace: true });
  };

  return (
    <div className="min-h-screen bg-white px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to CampusCord
        </Link>

        <div className="mt-10 inline-flex rounded-2xl border border-[#dbe3ff] bg-[#f5f7ff] p-3 text-[#465fff] shadow-sm">
          <BrandLogo compact />
        </div>

        <div className="mt-8">
          <h1 className="text-[30px] font-semibold leading-[38px] tracking-tight text-slate-900 sm:text-[36px] sm:leading-[44px]">
            Sign in to CampusCord.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Use your administrator credentials to access campus engagement, approvals, and reporting.
          </p>
        </div>

        {unauthorizedReason === "unauthorized" && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Access is limited to CampusCord administrators. Please sign in with an authorized account.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-slate-700">
              Email
            </Label>
            <Input
              id="email"
              placeholder="admin@campuscord.com"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="h-11 rounded-md border-slate-200 bg-white px-3 text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-[#465fff]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-slate-700">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                placeholder="Enter your password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                className="h-11 rounded-md border-slate-200 bg-white px-3 pr-11 text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-[#465fff]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-800"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Checkbox
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              Keep me signed in
            </label>
            <a
              href="mailto:support@campuscord.com"
              className="text-sm font-medium text-[#465fff] transition-colors hover:text-[#3641f5]"
            >
              Need help?
            </a>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            className="h-11 w-full rounded-md bg-[#465fff] text-sm font-medium text-white shadow-sm transition hover:bg-[#3641f5]"
            type="submit"
            loading={pending}
            disabled={pending}
          >
            Sign in
          </Button>
        </form>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <ShieldCheck className="h-4 w-4 text-[#465fff]" />
            CampusCord admin access
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            This portal uses Supabase authentication and is restricted to verified campus administrators.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
