import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
  club_id: string | null;
  officer_title: string | null;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: (userId?: string) => Promise<Profile | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) {
      setProfile(null);
      return null;
    }
    setProfile(data);
    return data;
  }, []);

  const handleSession = useCallback(
    async (nextSession: Session | null) => {
      setSession(nextSession);
      if (nextSession?.user?.id) {
        const shouldLoadProfile = profile?.id !== nextSession.user.id;
        if (shouldLoadProfile) {
          setLoading(true);
          await loadProfile(nextSession.user.id);
        }
        setLoading(false);
      } else {
        setProfile(null);
        setLoading(false);
      }
    },
    [loadProfile, profile?.id],
  );

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        await handleSession(data.session ?? null);
      }
    };

    initialize();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      handleSession(newSession);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [handleSession]);

  const refreshProfile = useCallback(
    async (userId?: string) => {
      const targetId = userId ?? session?.user?.id;
      if (!targetId) {
        setProfile(null);
        return null;
      }

      const { data, error } = await supabase.from("profiles").select("*").eq("id", targetId).single();

      if (error) {
        setProfile(null);
        return null;
      }

      setProfile(data);
      return data;
    },
    [session?.user?.id],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
