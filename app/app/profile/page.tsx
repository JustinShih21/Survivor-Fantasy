"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const TRIBE_NAME_MIN = 3;
const TRIBE_NAME_MAX = 24;

type ProfileData = {
  first_name: string;
  last_name: string;
  tribe_name: string;
  created_at?: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile: authProfile, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editTribe, setEditTribe] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile);
          setEditFirst(data.profile.first_name ?? "");
          setEditLast(data.profile.last_name ?? "");
          setEditTribe(data.profile.tribe_name ?? "");
        } else {
          setProfile(null);
        }
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [authLoading, user, router]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    const first = editFirst.trim();
    const last = editLast.trim();
    const tribe = editTribe.trim();
    if (!first || !last) {
      setEditError("First name and last name are required");
      return;
    }
    if (tribe.length < TRIBE_NAME_MIN || tribe.length > TRIBE_NAME_MAX) {
      setEditError(`Tribe name must be ${TRIBE_NAME_MIN}-${TRIBE_NAME_MAX} characters`);
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: first,
          last_name: last,
          tribe_name: tribe,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Failed to update profile");
        setEditSaving(false);
        return;
      }
      if (data.profile) {
        setProfile(data.profile);
        setEditFirst(data.profile.first_name);
        setEditLast(data.profile.last_name);
        setEditTribe(data.profile.tribe_name);
      }
      setEditMode(false);
    } catch {
      setEditError("Network error. Please try again.");
    }
    setEditSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirm || deleteType !== "DELETE") return;
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error ?? "Failed to delete account");
        setDeleteLoading(false);
        return;
      }
      await signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setDeleteError("Network error. Please try again.");
      setDeleteLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-stone-400">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <p className="text-stone-400">You don&apos;t have a profile yet. Create one to get started.</p>
        <Link
          href="/onboarding"
          className="inline-block text-orange-400 hover:text-orange-300 font-medium"
        >
          Set up profile →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Profile</h1>
        <p className="text-stone-400 text-sm mt-1">View and manage your account</p>
      </div>

      <div className="p-6 rounded-2xl texture-sandy bg-stone-800/90 stone-outline shadow-xl space-y-4">
        <h2 className="text-lg font-semibold text-stone-100">Your info</h2>
        {!editMode ? (
          <>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-stone-500">First name</dt>
                <dd className="text-stone-100 font-medium">{profile.first_name}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Last name</dt>
                <dd className="text-stone-100 font-medium">{profile.last_name}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Tribe name</dt>
                <dd className="text-stone-100 font-medium">{profile.tribe_name}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="text-sm text-orange-400 hover:text-orange-300 font-medium"
            >
              Edit profile
            </button>
          </>
        ) : (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {editError && (
              <div className="p-3 rounded-lg bg-red-900/50 border border-red-700/50 text-red-200 text-sm">
                {editError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="profile-first" className="block text-sm font-medium text-stone-300 mb-1">
                  First name
                </label>
                <input
                  id="profile-first"
                  type="text"
                  value={editFirst}
                  onChange={(e) => setEditFirst(e.target.value)}
                  required
                  maxLength={50}
                  className="w-full px-4 py-2 rounded-lg bg-stone-900/80 border border-stone-600/50 text-stone-100 focus:outline-none focus:border-orange-500/70"
                />
              </div>
              <div>
                <label htmlFor="profile-last" className="block text-sm font-medium text-stone-300 mb-1">
                  Last name
                </label>
                <input
                  id="profile-last"
                  type="text"
                  value={editLast}
                  onChange={(e) => setEditLast(e.target.value)}
                  required
                  maxLength={50}
                  className="w-full px-4 py-2 rounded-lg bg-stone-900/80 border border-stone-600/50 text-stone-100 focus:outline-none focus:border-orange-500/70"
                />
              </div>
            </div>
            <div>
              <label htmlFor="profile-tribe" className="block text-sm font-medium text-stone-300 mb-1">
                Tribe name
              </label>
              <input
                id="profile-tribe"
                type="text"
                value={editTribe}
                onChange={(e) => setEditTribe(e.target.value)}
                required
                minLength={TRIBE_NAME_MIN}
                maxLength={TRIBE_NAME_MAX}
                className="w-full px-4 py-2 rounded-lg bg-stone-900/80 border border-stone-600/50 text-stone-100 focus:outline-none focus:border-orange-500/70"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={editSaving}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-stone-950 font-medium"
              >
                {editSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditMode(false);
                  setEditFirst(profile.first_name);
                  setEditLast(profile.last_name);
                  setEditTribe(profile.tribe_name);
                  setEditError(null);
                }}
                className="px-4 py-2 rounded-lg bg-stone-600 hover:bg-stone-500 text-stone-100"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="p-6 rounded-2xl bg-stone-800/90 border border-stone-700/50 shadow-xl space-y-4">
        <h2 className="text-lg font-semibold text-stone-100">Delete account</h2>
        <p className="text-stone-400 text-sm">
          Permanently delete your account and data. This cannot be undone. Your tribe, league memberships, and all game data will be removed.
        </p>
        {deleteError && (
          <div className="p-3 rounded-lg bg-red-900/50 border border-red-700/50 text-red-200 text-sm">
            {deleteError}
          </div>
        )}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-stone-300 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.checked)}
              className="rounded border-stone-600 bg-stone-900 text-orange-500 focus:ring-orange-500/50"
            />
            I understand this is permanent and I want to delete my account
          </label>
          <div>
            <label htmlFor="delete-type" className="block text-sm font-medium text-stone-300 mb-1">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              id="delete-type"
              type="text"
              value={deleteType}
              onChange={(e) => setDeleteType(e.target.value)}
              placeholder="DELETE"
              className="w-full max-w-xs px-4 py-2 rounded-lg bg-stone-900/80 border border-stone-600/50 text-stone-100 focus:outline-none focus:border-red-500/70"
            />
          </div>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={!deleteConfirm || deleteType !== "DELETE" || deleteLoading}
            className="px-4 py-2 rounded-lg bg-red-800 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-red-100 font-medium"
          >
            {deleteLoading ? "Deleting..." : "Delete my account"}
          </button>
        </div>
      </div>
    </div>
  );
}
