"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Profile {
  first_name: string;
  last_name: string;
  tribe_name: string;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback", "/onboarding", "/privacy", "/terms"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);
  useLayoutEffect(() => {
    pathnameRef.current = pathname;
    routerRef.current = router;
  }, [pathname, router]);

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name, tribe_name")
      .eq("id", userId)
      .single();
    return data as Profile | null;
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const AUTH_TIMEOUT_MS = 3000;
    const timeoutId = setTimeout(() => {
      console.warn("Auth check timed out — clearing loading state");
      setLoading(false);
    }, AUTH_TIMEOUT_MS);

    supabase.auth.getUser().then(async ({ data: { user: currentUser } }) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const p = await fetchProfile(currentUser.id);
          setProfile(p);
          if (!p && pathnameRef.current !== "/onboarding") {
            routerRef.current.push("/onboarding");
          }
        } catch (err) {
          console.error("Failed to fetch profile:", err);
        }
      } else {
        // Don't redirect if already on login, callback, or other public auth pages
        const isPublic = PUBLIC_PATHS.some((p) => pathnameRef.current.startsWith(p));
        if (!isPublic) {
          routerRef.current.push("/login");
        }
      }
    }).catch((err) => {
      console.error("Auth check failed:", err);
    }).finally(() => {
      clearTimeout(timeoutId);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);

      if (newUser) {
        try {
          const p = await fetchProfile(newUser.id);
          setProfile(p);
        } catch (err) {
          console.error("Failed to fetch profile on auth change:", err);
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "global" });
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      setUser(null);
      setProfile(null);
      window.location.href = "/login";
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
