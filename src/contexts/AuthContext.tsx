import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  avatar_url: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  role: AppRole | null;
  mentorActive: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: AppRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_CACHE_KEY = "app:lastProfile";

const readCachedProfile = (): UserProfile | null => {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
};

const writeCachedProfile = (profile: UserProfile | null) => {
  try {
    if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    /* noop */
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => readCachedProfile());
  const [mentorActive, setMentorActive] = useState(true);
  // Only show loading spinner if we have no cached profile AND no cached session.
  // This prevents the refresh "flicker" that bounces logged-in users to /login.
  const [loading, setLoading] = useState(() => !readCachedProfile());

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("users")
      .select("id, email, full_name, role, avatar_url")
      .eq("id", userId)
      .single();
    setProfile(data);
    writeCachedProfile(data);
    if (data?.role === "mentor") {
      const { data: mp } = await supabase
        .from("mentor_profiles")
        .select("is_active")
        .eq("user_id", userId)
        .maybeSingle();
      setMentorActive(!!mp?.is_active);
    } else {
      setMentorActive(true);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
          setMentorActive(false);
          writeCachedProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        // No session at all → make sure we don't keep stale cached profile around
        writeCachedProfile(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string, role: AppRole) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    // Optionally redirect to IdP logout afterwards
    let logoutUrl: string | null = null;
    try {
      const { data: cfg } = await supabase
        .from("jwt_config")
        .select("enabled, logout_redirect_url")
        .limit(1)
        .maybeSingle();
      if (cfg?.enabled && cfg.logout_redirect_url) logoutUrl = cfg.logout_redirect_url;
    } catch {
      /* noop — non-fatal */
    }

    await supabase.auth.signOut();
    setProfile(null);
    setMentorActive(false);
    writeCachedProfile(null);

    if (logoutUrl) {
      window.location.href = logoutUrl;
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role: profile?.role ?? null,
        mentorActive,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
