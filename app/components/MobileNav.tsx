"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppData } from "./AppDataProvider";
import { useAuth } from "./AuthProvider";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/points", label: "Points" },
  { href: "/transfers", label: "Transfers" },
  { href: "/pick-team", label: "Pick Team" },
  { href: "/leagues", label: "Leagues" },
  { href: "/stats", label: "Stats" },
  { href: "/rules", label: "Rules" },
] as const;

const DATA_PREFETCH_ROUTES = ["/", "/points", "/transfers", "/pick-team"];

export function MobileNav() {
  const pathname = usePathname();
  const { data, refetch } = useAppData();
  const { user, profile, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    queueMicrotask(() => setIsOpen(false));
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    } else {
      menuButtonRef.current?.focus();
    }
  }, [isOpen]);

  const isAdmin = data?.isAdmin === true;

  const prefetchData = () => {
    refetch();
  };

  return (
    <>
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg text-stone-300 hover:text-stone-100 hover:bg-stone-800/50 transition-colors touch-manipulation"
        aria-label="Open menu"
        aria-expanded={isOpen}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-30 md:hidden"
            aria-hidden
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-stone-900 border-r border-stone-700 z-40 overflow-y-auto shadow-xl md:hidden flex flex-col"
            role="dialog"
            aria-label="Navigation menu"
          >
            <div className="flex items-center justify-between p-4 border-b border-stone-700">
              <span className="text-sm font-semibold text-stone-200">Menu</span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center w-11 h-11 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors touch-manipulation"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col p-3 gap-1">
              {NAV_LINKS.map(({ href, label }) => {
                const isActive =
                  href === "/" ? pathname === "/" : pathname.startsWith(href);
                const shouldPrefetch = DATA_PREFETCH_ROUTES.includes(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    onMouseEnter={shouldPrefetch ? prefetchData : undefined}
                    onFocus={shouldPrefetch ? prefetchData : undefined}
                    className={`min-h-[44px] flex items-center px-4 rounded-lg text-base font-medium transition-colors touch-manipulation ${
                      isActive
                        ? "bg-orange-900/40 text-orange-400 border border-orange-700/50"
                        : "text-stone-200 hover:bg-stone-800"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className={`min-h-[44px] flex items-center px-4 rounded-lg text-base font-medium transition-colors touch-manipulation ${
                    pathname.startsWith("/admin")
                      ? "bg-orange-900/40 text-orange-400 border border-orange-700/50"
                      : "text-stone-200 hover:bg-stone-800"
                  }`}
                >
                  Admin
                </Link>
              )}
            </nav>
            {user && (
              <div className="mt-auto p-3 border-t border-stone-700 space-y-1">
                {profile && (
                  <div className="px-4 py-2 text-sm text-stone-400">
                    {profile.first_name && profile.last_name
                      ? `${profile.first_name} ${profile.last_name}`
                      : profile.tribe_name}
                  </div>
                )}
                <Link
                  href="/profile"
                  onClick={() => setIsOpen(false)}
                  className="min-h-[44px] flex items-center px-4 rounded-lg text-base text-stone-200 hover:bg-stone-800 transition-colors touch-manipulation"
                >
                  Profile
                </Link>
                <a
                  href="/login"
                  className="min-h-[44px] flex items-center px-4 rounded-lg text-base text-stone-200 hover:bg-stone-800 transition-colors touch-manipulation"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsOpen(false);
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
            )}
          </div>
        </>
      )}
    </>
  );
}
