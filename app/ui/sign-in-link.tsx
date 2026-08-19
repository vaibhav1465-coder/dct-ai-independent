"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type SignInLinkProps = {
  className?: string;
  label?: string;
  loadingLabel?: string;
  mode?: "route" | "google";
};

export function SignInLink({ className = "user", label = "Sign in", loadingLabel = "Opening sign in...", mode = "route" }: SignInLinkProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    if (mode === "google") {
      await signIn("google", { callbackUrl: "/" });
      return;
    }
    router.push("/auth/signin");
  }

  return <button className={className} type="button" onClick={handleClick} disabled={loading} aria-busy={loading}>{loading ? loadingLabel : label}</button>;
}
