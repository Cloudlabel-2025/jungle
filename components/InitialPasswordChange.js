"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, AlertTriangle, LogOut } from "lucide-react";
import fetch from "@/lib/college-fetch.js";
import { prefix } from "@/lib/catalog.js";
import { VowEmblem } from "./VowBrand";

export default function InitialPasswordChange({ college, user, onSignOut }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const pending = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return <main className="vow-login-scene">
    <section className="vow-login-panel vow-password-setup" aria-labelledby="password-setup-title">
      <header className="vow-login-heading">
        <VowEmblem eager decorative />
        <p className="vow-login-brand">Welcome, {user.name}</p>
        <h1 id="password-setup-title">Set your permanent password</h1>
        <p className="vow-password-setup-note">Replace your initial password before continuing. Use at least 8 characters.</p>
        {college && <p className="vow-login-college">{college.name}</p>}
      </header>
      <form method="post" className="vow-login-form" aria-busy={busy || !ready} onSubmit={async event => {
        event.preventDefault(); if (pending.current) return;
        const values = new FormData(event.currentTarget), newPassword = values.get("newPassword"), confirmPassword = values.get("confirmPassword");
        if (newPassword !== confirmPassword) { setError("The passwords do not match."); return; }
        pending.current = true; setBusy(true); setError("");
        try {
          const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword, confirmPassword }) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Unable to save your password.");
          window.location.assign(`/${prefix(result.user.role)}/dashboard`);
        } catch (failure) { setError(failure.message); pending.current = false; setBusy(false); }
      }}>
        <div className="vow-login-field"><label htmlFor="permanent-password">New password</label><input id="permanent-password" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={256} /></div>
        <div className="vow-login-field"><label htmlFor="permanent-password-confirm">Confirm password</label><input id="permanent-password-confirm" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={256} /></div>
        {error && <p className="vow-login-error" role="alert"><AlertTriangle size={17} />{error}</p>}
        <button className="vow-login-submit" disabled={busy || !ready}>{busy ? "Saving…" : "Confirm password"}<ArrowRight size={20} /></button>
      </form>
      <button className="vow-password-sign-out" disabled={busy} onClick={onSignOut}><LogOut size={16} />Sign out</button>
    </section>
  </main>;
}
