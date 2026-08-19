import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";
import { isApprovedUserEmail } from "./access-policy";
export type CurrentUser = { id: string; email: string; role: "JOURNALIST" | "ADMIN" };
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (process.env.NODE_ENV === "development" && process.env.DCT_LOCAL_ADMIN === "true") return { id: "local-admin", email: "vaibhav.singh@indianexpress.com", role: "ADMIN" };
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!session?.user?.id || !email || !(await isApprovedUserEmail(email))) return null;
  return { id: session.user.id, email, role: session.user.role };
}
export function isAdmin(user: CurrentUser | null): user is CurrentUser { return user?.role === "ADMIN"; }
