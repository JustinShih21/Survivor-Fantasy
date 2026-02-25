"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "./AuthProvider";
import { AppDataProvider, useAppData } from "./AppDataProvider";
import { MobileNav } from "./MobileNav";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/points", label: "Points" },
  { href: "/transfers", label: "Transfers" },
  { href: "/pick-team", label: "Pick Team" },
  { href: "/leagues", label: "Leagues" },
  { href: "/stats", label: "Stats" },
  { href: "/rules", label: "Rules" },
] as const;

const AUTH_PAGES = ["/login", "/signup", "/onboarding", "/auth/callback", "/privacy", "/terms"];

const DATA_PREFETCH_ROUTES = ["/", "/points", "/transfers", "/pick-team"];

function NavLinks({ pathname }: { pathname: string }) {
  const { data, refetch } = useAppData();
  const prefetchData = () => {
    refetch();
  };
  const isAdmin = data?.isAdmin === true;
  return (
    <>
      {NAV_LINKS.map(({ href, label }) => {
        const isActive =
          href === "/"
            ? pathname === "/"
            : pathname.startsWith(href);
        const shouldPrefetch = DATA_PREFETCH_ROUTES.includes(href);
        return (
          <Link
            key={href}
            href={href}
            onMouseEnter={shouldPrefetch ? prefetchData : undefined}
            className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "texture-sandy stone-outline-orange text-stone-100 border-b-2 border-stone-500"
                : "text-stone-300/80 hover:text-stone-100 hover:bg-stone-800/50"
            }`}
          >
            {label}
          </Link>
        );
      })}
      {isAdmin && (
        <Link
          href="/admin"
          className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname.startsWith("/admin")
              ? "texture-sandy stone-outline-orange text-stone-100 border-b-2 border-stone-500"
              : "text-stone-300/80 hover:text-stone-100 hover:bg-stone-800/50"
          }`}
        >
          Admin
        </Link>
      )}
    </>
  );
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, loading, signOut } = useAuth();

  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <AppDataProvider>
      <div className="min-h-screen relative bg-black">
        <div className="tribal-bg" aria-hidden />
        <div className="fire-glimmer" aria-hidden />
        <header className="relative z-20 border-b-2 border-orange-800/50 bg-black shadow-xl sticky top-0 pt-[env(safe-area-inset-top)]">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/"
                className="text-xl font-bold text-stone-100 tracking-wide shrink-0 min-h-[44px] flex items-center"
              >
                Survivor Fantasy Team
              </Link>
              <div className="flex items-center gap-2">
                <MobileNav />
                {loading ? (
                  <div className="flex items-center gap-2" aria-label="Checking auth">
                    <div className="w-5 h-5 border-2 border-stone-600 border-t-orange-500 rounded-full animate-spin" />
                    <span className="text-xs text-stone-400 hidden sm:inline">Loading...</span>
                  </div>
                ) : user ? (
                  <div className="hidden md:flex items-center gap-2 flex-wrap justify-end">
                    {profile && (
                      <>
                        <span className="text-sm text-stone-200 font-medium shrink-0">
                          {profile.first_name && profile.last_name
                            ? `${profile.first_name} ${profile.last_name}`
                            : profile.tribe_name}
                        </span>
                        <span className="text-stone-600 shrink-0" aria-hidden>·</span>
                      </>
                    )}
                    <Link
                      href="/profile"
                      className="text-sm text-stone-400 hover:text-stone-200 transition-colors shrink-0 min-h-[44px] flex items-center"
                    >
                      Profile
                    </Link>
                    <span className="text-stone-600 shrink-0" aria-hidden>·</span>
                    <a
                      href="/login"
                      className="text-sm text-stone-400 hover:text-stone-200 transition-colors shrink-0 cursor-pointer min-h-[44px] flex items-center"
                      onClick={(e) => {
                        e.preventDefault();
                        try {
                          signOut();
                        } catch {
                          // ensure redirect even if signOut throws
                        }
                        window.location.href = "/login";
                      }}
                    >
                      Sign out
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
            <nav className="hidden md:flex gap-1 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
              <NavLinks pathname={pathname} />
            </nav>
          </div>
        </header>
        <main className="relative z-10 max-w-2xl mx-auto px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
    </AppDataProvider>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </AuthProvider>
  );
}
