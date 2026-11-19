"use client";
import { useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
export default function CollegeLoginUrl({ url }) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState("");
  if (!url) return null;
  return (
    <section className="pa-college-url" aria-label="College login URL">
      <div>
        <span className="pa-kicker">COLLEGE LOGIN URL</span>
        <h2>A dedicated entrance for this college</h2>
        <p>
          Share this address with CCs, MCs and players. They sign in here with
          their own account.
        </p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="pa-college-url-value"
      >
        {url}
      </a>
      <div className="pa-college-url-actions">
        <a className="pa-primary" href={url} target="_blank" rel="noreferrer">
          Open college
          <ArrowRight size={16} />
        </a>
        <button
          className="pa-secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setError("");
            } catch {
              setError("Select and copy the college URL above.");
            }
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy URL"}
        </button>
      </div>
      {(copied || error) && (
        <p role="status" className="pa-note">
          {error || "College URL copied."}
        </p>
      )}
    </section>
  );
}
