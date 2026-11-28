"use client";
import { createPortal } from "react-dom";

// A visual layer only: no focus capture, input blocking or manual dismissal.
export default function RewardOverlay({ title, duration, children }) {
  const overlay = <div className="reward-celebration-backdrop" role="status" aria-live="polite" aria-atomic="true" aria-label={title} style={{"--reward-duration":`${duration}ms`}}>
    <div className="reward-celebration-window">{children}</div>
  </div>;
  return typeof document === "undefined" ? overlay : createPortal(overlay, document.body);
}
