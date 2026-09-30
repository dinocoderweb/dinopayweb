"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { readSession, rpc, signIn, signOut, signUp } from "@/lib/supabase";

export function AuthForm({ inviteOnly = false }: { inviteOnly?: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [slug, setSlug] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite");
    if (token) {
      setInviteToken(token);
      setMode("signup");
    }
    const session = readSession();
    setSignedIn(Boolean(session));
    if (session && !token) window.location.assign("/dashboard");
  }, []);

  function updateWorkspaceName(value: string) {
    setWorkspaceName(value);
    setSlug(value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  }

  async function finishInvite() {
    if (!inviteToken) return false;
    await rpc("accept_staff_invite", { p_token: inviteToken });
    window.location.assign("/dashboard");
    return true;
  }

  async function createWorkspace() {
    if (inviteToken) {
      await finishInvite();
      return;
    }
    if (!workspaceName.trim() || !slug) throw new Error("Add a studio name to continue.");
    await rpc("create_business", { p_name: workspaceName.trim(), p_slug: slug });
    window.location.assign("/dashboard");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
        if (inviteToken) await finishInvite();
        else window.location.assign("/dashboard");
      } else {
        const result = await signUp(email.trim(), password);
        if (result.confirmationRequired) {
          setNotice("Check your inbox to confirm your email, then return here and sign in to finish setup.");
          return;
        }
        if (inviteToken) await finishInvite();
        else {
          setNotice("One last step: name your print studio.");
          setSignedIn(true);
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function setupWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createWorkspace();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not finish setup.");
    } finally {
      setBusy(false);
    }
  }

  async function continueInvite() {
    setBusy(true);
    setError("");
    try {
      await finishInvite();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This invite could not be accepted.");
    } finally {
      setBusy(false);
    }
  }

  const needsWorkspace = signedIn && mode === "signup" && !inviteToken && notice.includes("name your print studio");

  return (
    <main className="auth-page">
      <div className="auth-left">
        <Link className="brand-lockup auth-brand" href="/"><span className="brand-mark">P</span><span>printdesk</span></Link>
        <div className="auth-message"><div className="eyebrow"><span className="eyebrow-dot" /> MADE FOR PRINT TEAMS</div><h1>Keep good work<br /><span>moving forward.</span></h1><p>Bookings, production dates, and payments together — so your team can focus on making great things.</p></div>
        <div className="auth-left-foot"><span>BOOK IT. MAKE IT. MARK IT PAID.</span><span>© Print Desk</span></div>
      </div>
      <section className="auth-panel">
        <div className="auth-card">
          <Link className="back-link" href="/">← Back to home</Link>
          {needsWorkspace ? (
            <>
              <div className="auth-icon">✳</div><p className="auth-kicker">WORKSPACE SETUP</p><h2>Name your studio</h2><p className="auth-subtitle">Your team will share this workspace across devices.</p>
              <form onSubmit={setupWorkspace} className="stack-form">
                <label>Studio name<input required maxLength={80} value={workspaceName} onChange={(event) => updateWorkspaceName(event.target.value)} placeholder="e.g. Sunday Print Co." /></label>
                <label>Booking link<input required maxLength={48} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="sunday-print-co" /><small>Customers use printdesk.app/book/{slug || "your-studio"}</small></label>
                {error && <div className="form-alert form-alert-error">{error}</div>}
                <button className="button button-primary button-wide" disabled={busy}>{busy ? "Creating workspace…" : "Create workspace →"}</button>
              </form>
            </>
          ) : signedIn && inviteToken ? (
            <>
              <div className="auth-icon">✳</div><p className="auth-kicker">TEAM INVITATION</p><h2>Join the print team</h2><p className="auth-subtitle">Accept your invitation to access shared bookings, the schedule, and payment records.</p>
              {notice && <div className="form-alert">{notice}</div>}{error && <div className="form-alert form-alert-error">{error}</div>}
              <button className="button button-primary button-wide" onClick={continueInvite} disabled={busy}>{busy ? "Joining…" : "Accept invitation →"}</button>
              <button className="text-button" onClick={() => { void signOut(); setSignedIn(false); }}>Sign out and use another account</button>
            </>
          ) : (
            <>
              <div className="auth-icon">{inviteOnly || inviteToken ? "＋" : "✳"}</div>
              <p className="auth-kicker">{inviteToken ? "TEAM INVITATION" : mode === "signup" ? "GET YOUR STUDIO SET UP" : "WELCOME BACK"}</p>
              <h2>{inviteToken ? "Create your team login" : mode === "signup" ? "Start your workspace" : "Sign in to Print Desk"}</h2>
              <p className="auth-subtitle">{inviteToken ? "Use your invited email to join the shared workspace." : mode === "signup" ? "Create your account. You can invite your team next." : "Your bookings and team updates are waiting."}</p>
              {(!inviteOnly || inviteToken) && <div className="auth-tabs"><button type="button" className={mode === "signin" ? "selected" : ""} onClick={() => { setMode("signin"); setNotice(""); setError(""); }}>Sign in</button><button type="button" className={mode === "signup" ? "selected" : ""} onClick={() => { setMode("signup"); setNotice(""); setError(""); }}>Create account</button></div>}
              <form onSubmit={submit} className="stack-form">
                <label>Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@yourstudio.com" /></label>
                <label>Password<input required type="password" minLength={mode === "signup" ? 8 : 1} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} /></label>
                {notice && <div className="form-alert">{notice}</div>}
                {error && <div className="form-alert form-alert-error">{error}</div>}
                <button className="button button-primary button-wide" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account →" : "Continue to workspace →"}</button>
              </form>
              <div className="auth-safe">🔒 &nbsp;Your workspace is private to your team.</div>
              {inviteOnly && !inviteToken && <p className="invite-hint">Open the personal invite link your studio owner sent you. <Link href="/login">Go to sign in</Link></p>}
              {!inviteOnly && <Link href="/join" className="invite-link">Joining an existing team? Use your invite link →</Link>}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
