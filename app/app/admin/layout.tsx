import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    redirect("/login");
  }
  const admin = await isAdmin(auth.supabase);
  if (!admin) {
    redirect("/");
  }
  return <>{children}</>;
}
