"use client";
import { createContext, useContext } from "react";

export const WorkspaceContext = createContext(null);
export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace)
    throw new Error("Workspace screens must be inside the workspace shell.");
  return workspace;
}
