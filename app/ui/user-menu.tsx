"use client";

import { FormEvent, useState } from "react";
import { signOut } from "next-auth/react";

type SubmitState = "idle" | "sending" | "sent" | "error";

export function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch("/api/user-feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject: formData.get("subject"), message: formData.get("message") }),
    });
    if (response.ok) {
      form.reset();
      setState("sent");
      return;
    }
    const data = await response.json().catch(() => ({}));
    setError(typeof data.error === "string" ? data.error : "Could not save feedback right now.");
    setState("error");
  }

  return <div className="user-menu"><button className="user" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><i/> {email}</button>{open ? <div className="user-dropdown"><button type="button" onClick={() => setOpen(false)}>Stay logged in</button><button type="button" onClick={() => { setFeedbackOpen(true); setOpen(false); setState("idle"); setError(""); }}>Feedback</button><button type="button" onClick={() => signOut({ callbackUrl: "/auth/signedout" })}>Log out</button></div> : null}{feedbackOpen ? <div className="feedback-modal" role="dialog" aria-modal="true" aria-label="Send DCT feedback"><form className="feedback-form card" onSubmit={submitFeedback}><div className="feedback-form-head"><div><p className="eyebrow">DCT AI INDEPENDENT FEEDBACK</p><h2>Send feedback</h2></div><button type="button" aria-label="Close feedback form" onClick={() => setFeedbackOpen(false)}>×</button></div><p>Your note will be saved for Vaibhav Singh and Chandan Kumar.</p><label>Subject<input name="subject" required maxLength={120} placeholder="Short subject"/></label><label>Message<textarea name="message" required maxLength={2000} minLength={10} placeholder="Write the issue, suggestion or question here"/></label>{state === "sent" ? <p className="feedback-ok">Feedback received. Thank you.</p> : null}{state === "error" ? <p className="form-error">{error}</p> : null}<div className="feedback-form-actions"><button type="button" onClick={() => setFeedbackOpen(false)}>Cancel</button><button type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending..." : "Send feedback"}</button></div></form></div> : null}</div>;
}
