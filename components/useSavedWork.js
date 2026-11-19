"use client";
import fetch from "@/lib/college-fetch.js";

import { useEffect, useRef, useState } from "react";

const pendingWork = new Map();

export async function flushPendingWork(ownerId) {
  const promises = [];
  window.dispatchEvent(
    new CustomEvent("codewild:flush-work", { detail: { promises, ownerId } }),
  );
  await Promise.all([
    ...new Set([
      ...promises,
      ...[...pendingWork]
        .filter(([, owner]) => owner === ownerId)
        .map(([promise]) => promise),
    ]),
  ]);
}

// One serialized queue per open work item. Failed saves retain the editor value.
export default function useSavedWork({
  value,
  initialValue,
  initialVersion = 0,
  enabled,
  endpoint,
  ownerId,
  payload = {},
  buildBody,
  onSaved,
}) {
  const [status, setStatus] = useState("");
  const saved = useRef(JSON.stringify(initialValue)),
    revision = useRef(initialVersion);
  const queue = useRef(Promise.resolve()),
    mounted = useRef(true),
    latest = useRef(null),
    flushRef = useRef(null);
  const boundOwner = useRef(ownerId);
  latest.current = {
    value,
    enabled: enabled && ownerId === boundOwner.current,
    endpoint,
    ownerId,
    payload,
    buildBody,
    onSaved,
  };
  const flush = (override) => {
    const item = latest.current;
    if (!item.enabled) return queue.current.catch(() => {});
    const snapshot = structuredClone(override ?? item.value),
      key = JSON.stringify(snapshot);
    const pending = queue.current
      .catch(() => {})
      .then(async () => {
        if (key === saved.current) return;
        if (mounted.current) setStatus("Saving draft…");
        const body = item.buildBody
          ? item.buildBody(snapshot, revision.current)
          : {
              ...item.payload,
              ...snapshot,
              ownerId: item.ownerId,
              draftVersion: revision.current,
            };
        const response = await fetch(item.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Draft could not be saved.");
        if (result.expired)
          throw new Error(
            "The activity timer ended. Your last saved work is retained.",
          );
        revision.current =
          result.draftVersion ??
          result.attemptVersion ??
          result.version ??
          revision.current;
        saved.current = key;
        if (mounted.current) {
          setStatus("Draft saved to your account");
          item.onSaved?.(snapshot);
        }
      })
      .catch((error) => {
        if (mounted.current) setStatus(`Not saved: ${error.message}`);
        throw error;
      });
    queue.current = pending;
    pendingWork.set(pending, item.ownerId);
    pending.then(
      () => pendingWork.delete(pending),
      () => pendingWork.delete(pending),
    );
    return pending;
  };
  flushRef.current = flush;
  const changed = JSON.stringify(value);
  useEffect(() => {
    if (!enabled || changed === saved.current) return;
    const timer = setTimeout(() => flushRef.current().catch(() => {}), 800);
    return () => clearTimeout(timer);
  }, [changed, enabled]);
  useEffect(() => {
    mounted.current = true;
    const register = (e) => {
      if (e.detail.ownerId === boundOwner.current)
        e.detail.promises.push(flushRef.current());
    };
    const protect = (e) => {
      if (
        latest.current.enabled &&
        JSON.stringify(latest.current.value) !== saved.current
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("codewild:flush-work", register);
    window.addEventListener("beforeunload", protect);
    return () => {
      mounted.current = false;
      window.removeEventListener("codewild:flush-work", register);
      window.removeEventListener("beforeunload", protect);
      flushRef.current().catch(() => {});
    };
  }, []);
  return {
    status,
    flush,
    restore: (next, version) => {
      saved.current = JSON.stringify(next);
      revision.current = version;
    },
    getVersion: () => revision.current,
    syncVersion: (version) => {
      if (JSON.stringify(latest.current.value) === saved.current)
        revision.current = version;
    },
  };
}
