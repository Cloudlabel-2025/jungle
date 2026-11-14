"use client";
import { createPortal } from "react-dom";

export default function PipStage({ children }) {
  const scene = (
    <div className="pip-appearance">
      <div className="pip-appearance-shade" aria-hidden="true" />
      {children}
    </div>
  );
  return typeof document === "undefined"
    ? scene
    : createPortal(scene, document.body);
}
