"use client";
import { useSelectedLayoutSegment } from "next/navigation";
import Arena from "./Arena";

// Layouts survive screen navigation. Keep the authenticated session's data,
// polling and header here; page-specific forms still unmount with their page.
export default function WorkspaceShell({ children, ...props }) {
  const screen = useSelectedLayoutSegment();
  return (
    <Arena {...props} screen={screen}>
      {children}
    </Arena>
  );
}
