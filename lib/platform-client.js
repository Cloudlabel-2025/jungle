"use client";
export async function platformApi(path, { body, method = body ? "POST" : "GET", signal } = {}) {
  const response = await fetch(`/api/platform/${path}`, { method, cache: "no-store", signal,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || "Unable to complete this action."), { status: response.status });
  return result;
}
