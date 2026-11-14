"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, MousePointerClick } from "lucide-react";
import { pipPointerPosition } from "@/lib/pip-pointer";

export default function PipPointer({ target, dismiss, label = "Click here" }) {
  const [position, setPosition] = useState(null);
  useEffect(() => {
    function update() {
      if (
        !target.isConnected ||
        target.closest("[hidden]") ||
        target.matches(':disabled,[aria-disabled="true"]')
      ) {
        dismiss();
        return;
      }
      const next = target.getClientRects().length
        ? pipPointerPosition(
            target.getBoundingClientRect(),
            {
              width: window.innerWidth,
              height: window.innerHeight,
            },
            Boolean(label),
          )
        : null;
      setPosition((previous) =>
        previous?.left === next?.left &&
        previous?.top === next?.top &&
        previous?.direction === next?.direction
          ? previous
          : next,
      );
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const timer = setInterval(update, 180);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [target, dismiss, label]);
  if (!position || typeof document === "undefined") return null;
  const Arrow = position.direction === "down" ? ArrowDown : ArrowUp;
  return createPortal(
    <div
      className={`pip-click-pointer ${label ? "has-label" : ""} points-${position.direction}`}
      style={{ left: position.left, top: position.top }}
      aria-hidden="true"
    >
      {label && (
        <span>
          <MousePointerClick size={16} />
          {label}
        </span>
      )}
      <Arrow className="pip-click-arrow" size={34} strokeWidth={3} />
    </div>,
    document.body,
  );
}
