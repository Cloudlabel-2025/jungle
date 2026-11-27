"use client";
import { LogOut, LoaderCircle } from "lucide-react";

export default function NavLogoutButton({ onClick, busy = false }) {
  const Icon = busy ? LoaderCircle : LogOut;
  return <button type="button" className="nav-logout" onClick={onClick} disabled={busy} aria-busy={busy}>
    <Icon size={18} aria-hidden="true" />
    <span>{busy ? "Logging out…" : "Log out"}</span>
  </button>;
}
