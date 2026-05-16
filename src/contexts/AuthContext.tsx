import React, { createContext, useContext, useEffect, useRef, useState } from "react";
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

interface CachedAuth {
  profile: UserProfile;
  mentorActive: boolean;
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

const AUTH_CACHE_KEY = "app:lastAuth";

const readCache = (): CachedAuth | null => {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedAuth) : null;
  } catch {
    return null;
  }
};

const writeCache = (value: CachedAuth | null) => {
  try {
    if (value) localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(value));
    else localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    /* noop */
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cached = readCache();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(cached?.profile ?? null);
  const [mentorActive, setMentorActive] = useState<boolean>(cached?.mentorActive ?? true);
  // Loading stays true until we have either a confirmed-no-session OR a resolved profile.
  // Optimistic UI is driven from the cached profile above, not from `loading`.
  const [loading, setLoading] = useState(true);

  // Dedupe parallel profile fetches across onAuthStateChange + getSession.
  const fetchingFor = useRef<string | null>(null);
  const lastFetchedFor = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    if (fetchingFor.current === userId) return;
    fetchingFor.current = userId;
    try {
      const { data: profileData } = await supabase
        .from("users")
        .select("id, email, full_name, role, avatar_url")
        .eq("id", userId)
        .single();

      if (!profileData) {
        setProfile(null);
        setMentorActive(false);
        writeCache(null);
        return;
      }

      let isActive = true;
      if (profileData.role === "mentor") {
        const { data: mp } = await supabase
          .from("mentor_profiles")
          .select("is_active")
          .eq("user_id", userId)
          .maybeSingle();
        isActive = !!mp?.is_active;
      }

      setProfile(profileData);
      setMentorActive(isActive);
      writeCache({ profile: profileData, mentorActive: isActive });
      lastFetchedFor.current = userId;
    } finally {
      fetchingFor.current = null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted) return;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        const uid = nextSession?.user?.id ?? null;

        if (!uid) {
          setProfile(null);
          setMentorActive(false);
          writeCache(null);
          lastFetchedFor.current = null;
          setLoading(false);
          return;
        }

        // Only fetch if the user actually changed; otherwise keep optimistic data.
        if (uid !== lastFetchedFor.current) {
          fetchProfile(uid).finally(() => mounted && setLoading(false));
        } else {
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      const uid = initialSession?.user?.id ?? null;

      if (!uid) {
        writeCache(null);
        setProfile(null);
        setMentorActive(false);
        lastFetchedFor.current = null;
        setLoading(false);
        return;
      }

      if (uid !== lastFetchedFor.current) {
        fetchProfile(uid).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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
    let logoutUrl: string | null = null;
    try {
      const { data: cfg } = await supabase
        .from("jwt_config")
        .select("enabled, logout_redirect_url")
        .limit(1)
        .maybeSingle();
      if (cfg?.enabled && cfg.logout_redirect_url) logoutUrl = cfg.logout_redirect_url;
    } catch {
      /* noop */
    }

    await supabase.auth.signOut();
    setProfile(null);
    setMentorActive(false);
    writeCache(null);
    lastFetchedFor.current = null;

    if (logoutUrl) window.location.href = logoutUrl;
  };

  const refreshProfile = async () => {
    if (user) {
      lastFetchedFor.current = null;
      await fetchProfile(user.id);
    }
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
