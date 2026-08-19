import Link from "next/link";
import { SignInLink } from "../../ui/sign-in-link";
import { ClearSession } from "./clear-session";

export default function SignedOutPage() {
  return <main className="blocked card signin-card"><ClearSession /><p className="eyebrow">DCT — THANK YOU</p><h1>You are logged out.</h1><p>Thank you for using the Digital Coaching Tool. Your session has ended safely.</p><div className="signedout-actions"><Link className="button signin-button secondary" href="/">Back to home</Link><SignInLink className="button signin-button" label="Log in again" loadingLabel="Opening sign in..." mode="route"/></div></main>;
}
