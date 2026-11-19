"use client";
let activeCollege = null;
export function setActiveCollege(id) { activeCollege = id || null; }
export const getActiveCollege = () => activeCollege;
export const collegeStorageKey = key => activeCollege ? `college:${activeCollege}:${key}` : key;
export default function collegeFetch(input, init = {}) {
  const path = typeof input === "string" ? input : input?.url;
  if (activeCollege && typeof path === "string" && path.startsWith("/api/")) {
    const headers = new Headers(init.headers);
    headers.set("x-codewild-college", activeCollege);
    return globalThis.fetch(input, { ...init, headers });
  }
  return globalThis.fetch(input, init);
}
