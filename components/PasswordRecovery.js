"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { Field } from "./PlatformFields";
export default function PasswordRecovery({ college = null }) {
  const [token, setToken] = useState(""),
    [ready, setReady] = useState(false),
    [realm, setRealm] = useState("college");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    const url = new URL(location.href),
      savedToken = new URLSearchParams(url.hash.slice(1)).get("token");
    if (savedToken) {
      setToken(savedToken);
      history.replaceState(null, "", url.pathname + url.search);
    }
    setRealm(
      url.searchParams.get("realm") === "platform" ? "platform" : "college",
    );
    setReady(true);
  }, []);
  return (
    <main className="platform-admin pa-recovery-page">
      <section className="pa-password">
        <KeyRound size={28} />
        <h1>{token ? "Set a new password" : "Forgot your password?"}</h1>
        <p>
          {token
            ? "Your reset link works once and expires after 30 minutes."
            : "Request a reset link for your registered email address."}
        </p>
        {!ready ? (
          <p role="status">Loading…</p>
        ) : message ? (
          <>
            <div className="pa-success" role="status">
              {message}
            </div>
            <a
              className="pa-text-link"
              href={realm === "platform" ? "/platform" : "/gamer/dashboard"}
            >
              <ArrowLeft size={15} />
              Return to sign-in
            </a>
          </>
        ) : (
          <form
            method="post"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const fields = Object.fromEntries(new FormData(e.currentTarget));
              setError("");
              if (!token && realm === "college" && !college) {
                setError(
                  "Open your college's own URL to request a password reset.",
                );
                return;
              }
              if (token && fields.password !== fields.confirmPassword) {
                setError("The new passwords do not match.");
                return;
              }
              setBusy(true);
              try {
                const response = await fetch(
                  `/api/recovery/${token ? "reset" : "request"}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(
                      token
                        ? { token, password: fields.password }
                        : {
                            ...fields,
                            realm,
                            ...(realm === "college"
                              ? { collegeId: college.id }
                              : {}),
                          },
                    ),
                  },
                );
                const result = await response.json();
                if (!response.ok)
                  throw Error(
                    result.error || "Recovery is temporarily unavailable.",
                  );
                if (result.realm) setRealm(result.realm);
                setMessage(
                  token
                    ? "Password changed. Sign in with your new password."
                    : result.message,
                );
              } catch (error) {
                setError(error.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {token ? (
              <>
                <Field label="New password" hint="Use at least 8 characters.">
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={256}
                    required
                  />
                </Field>
                <Field label="Confirm new password">
                  <input
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={256}
                    required
                  />
                </Field>
              </>
            ) : (
              <>
                {!college && (
                  <Field label="Account type">
                    <select
                      value={realm}
                      onChange={(e) => setRealm(e.target.value)}
                    >
                      <option value="college">College account</option>
                      <option value="platform">Super admin</option>
                    </select>
                  </Field>
                )}
                {realm === "college" && (
                  <p className="pa-note">
                    {college ? (
                      <>
                        College: <strong>{college.name}</strong>
                      </>
                    ) : (
                      "Open your college's own URL to request a reset."
                    )}
                  </p>
                )}
                <Field
                  label={
                    realm === "college" ? "Username or email" : "Email address"
                  }
                >
                  <input
                    name="identifier"
                    type={realm === "college" ? "text" : "email"}
                    autoComplete="username"
                    maxLength={254}
                    required
                  />
                </Field>
              </>
            )}
            {error && (
              <p className="pa-error" role="alert">
                {error}
                {token && (
                  <a href={`/recover?realm=${realm}`} className="pa-text-link">
                    Request another reset email
                  </a>
                )}
              </p>
            )}
            <button className="pa-primary" disabled={busy}>
              {busy
                ? "Please wait…"
                : token
                  ? "Save new password"
                  : "Request reset email"}
              <Mail size={16} />
            </button>
            <a
              className="pa-text-link pa-recovery-back"
              href={realm === "platform" ? "/platform" : "/gamer/dashboard"}
            >
              <ArrowLeft size={15} />
              Return to sign-in
            </a>
          </form>
        )}
      </section>
    </main>
  );
}
