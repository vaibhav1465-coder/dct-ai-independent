import Link from "next/link";
import { getCurrentUser } from "../../lib/auth";
import { SignInLink } from "./sign-in-link";
import { UserMenu } from "./user-menu";
export async function Header({ active }: { active: "check" | "standards" | "admin" }) {
  const user = await getCurrentUser();
  return <header className="topbar"><Link href="/" className="brand"><b>DCT</b><span>Digital Coaching Tool<small>INDIAN EXPRESS GROUP</small><small className="framework-credit">Editorial framework by Andrea McCarren</small></span></Link><nav aria-label="Primary"><Link className={active === "check" ? "active" : ""} href="/">New check</Link><Link className={active === "standards" ? "active" : ""} href="/standards">Editorial Framework</Link>{user?.role === "ADMIN" && <Link className={active === "admin" ? "active" : ""} href="/admin">Administration</Link>}</nav>{user ? <UserMenu email={user.email}/> : <SignInLink className="user" label="Sign in" loadingLabel="Opening sign in..." mode="route"/>}</header>;
}
