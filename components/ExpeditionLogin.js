"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { VowEmblem } from "./VowBrand";
import { brand } from "@/lib/brand.js";

export default function ExpeditionLogin({
  onSignIn,
  demoAccess,
  tenancy = false,
  college = null,
}) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    if (tenancy && !college) {
      setError("Open the college URL provided by your Centre Command.");
      return;
    }
    const values = new FormData(event.currentTarget);
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await onSignIn({
        ...(tenancy ? { collegeId: college.id } : {}),
        identifier: String(values.get("identifier")).trim(),
        password: String(values.get("password")),
      });
    } catch (failure) {
      setError(failure.message || "Unable to sign in. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="vow-login-scene">
      <section className="vow-login-panel" aria-labelledby="vow-login-title">
        <header className="vow-login-heading">
          <VowEmblem eager decorative />
          <p className="vow-login-brand">{brand.name}</p>
          <h1 id="vow-login-title">Your adventure awaits.</h1>
          <p>Sign in to continue your voyage.</p>
          {tenancy && college && (
            <p className="vow-login-college">{college.name}</p>
          )}
        </header>
        <form method="post" className="vow-login-form" onSubmit={submit} aria-busy={busy || !ready}>
          <div className="vow-login-field">
            <label htmlFor="vow-identifier">Username or email</label>
            <input
              id="vow-identifier"
              name="identifier"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={120}
              placeholder="Enter your username or email"
              aria-describedby={error ? "vow-login-error" : undefined}
            />
          </div>
          <div className="vow-login-field">
            <label htmlFor="vow-password">Password</label>
            <div className="vow-login-password">
              <input
                id="vow-password"
                name="password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="Enter your password"
                aria-describedby={error ? "vow-login-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
              >
                {visible ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          {error && (
            <p id="vow-login-error" className="vow-login-error" role="alert">
              <AlertTriangle size={17} />
              {error}
            </p>
          )}
          <button className="vow-login-submit" disabled={busy || !ready} type="submit">
            {busy ? "Signing in…" : "Sign in"}
            <ArrowRight size={19} aria-hidden="true" />
          </button>
        </form>
        <p className="vow-login-help">
          Need access or a password reset? Contact Centre Command.
          {tenancy && (
            <>
              {" "}
              <a href={college?.slug ? `/c/${college.slug}/recover` : "/recover"}>Forgot password?</a>
            </>
          )}
        </p>
        {demoAccess && (
          <details className="vow-login-demo">
            <summary>Demo expedition access</summary>
            {demoAccess}
          </details>
        )}
      </section>
    </main>
  );
}
