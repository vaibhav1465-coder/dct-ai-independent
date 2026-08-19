"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

export function SignInButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    await signIn("google", { callbackUrl: "/" });
  }

  return <button className="button signin-button" type="button" onClick={handleClick} disabled={loading} aria-busy={loading}>{loading ? "Signing you in..." : "Continue with Google"}</button>;
}
