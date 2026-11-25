"use client";
import { useEffect, useRef, useState } from "react";
import fetch, { collegeStorageKey } from "@/lib/college-fetch.js";
import {
  mergeTeamFiles,
  recoverTeamDraft,
  sameTeamFiles,
} from "@/lib/team-lab-merge.js";
import { teamInitialFiles } from "@/lib/team-lab-project.js";

const same = sameTeamFiles;
async function request(url, body) {
  const r = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        }
      : { cache: "no-store", signal: AbortSignal.timeout(10000) },
  );
  const result = await r.json();
  if (!r.ok)
    throw new Error(result.error || "Team project could not be reached.");
  return result;
}

export default function useTeamLab(ownerId, active) {
  const [files, renderFiles] = useState(teamInitialFiles),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("Connecting to your team…"),
    [error, setError] = useState(""),
    [meta, setMeta] = useState({ presence: [], history: [] }),
    [conflicts, setConflicts] = useState([]),
    [draft, setDraft] = useState(null),
    [attempt, setAttempt] = useState(0);
  const state = useRef({
      files: teamInitialFiles,
      base: teamInitialFiles,
      version: 0,
      projectId: null,
      conflicts: [],
      ready: false,
    }),
    queue = useRef(Promise.resolve()),
    live = useRef(false),
    activeRef = useRef(active),
    backgroundSync = useRef(false),
    flushRef = useRef();
  activeRef.current = active;
  const storageKey = collegeStorageKey(`team-lab-draft:${ownerId}`);
  function persist() {
    const s = state.current;
    if (!s.ready || s.recoveryPending) return;
    try {
      if (same(s.files, s.base) && !s.conflicts.length)
        localStorage.removeItem(storageKey);
      else
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            projectId: s.projectId,
            files: s.files,
            base: s.base,
            version: s.version,
            conflicts: s.conflicts,
          }),
        );
    } catch {
      /* A full/disabled storage never blocks saving to the team. */
    }
  }
  function setFiles(value) {
    const next =
      typeof value === "function" ? value(state.current.files) : value;
    state.current.files = next;
    renderFiles(next);
    persist();
  }
  function accept(remote, base = state.current.base) {
    const s = state.current,
      merged = mergeTeamFiles(base, s.files, remote.files);
    s.files = merged.files;
    s.base = remote.files;
    s.version = remote.version;
    s.conflicts = merged.conflicts;
    renderFiles(s.files);
    setConflicts(s.conflicts);
    setMeta((old) => ({ ...old, ...remote, files: undefined }));
    persist();
    setStatus(
      s.conflicts.length
        ? "Review overlapping edits before syncing."
        : same(s.files, s.base)
          ? "Team project synced"
          : "Saving your changes…",
    );
  }
  function serialize(operation) {
    const next = queue.current.catch(() => {}).then(operation);
    queue.current = next;
    return next;
  }
  function flush() {
    return serialize(async () => {
      const s = state.current;
      if (!s.ready) throw new Error("Wait for your team project to load.");
      if (s.recoveryPending)
        throw new Error(
          "Recover or dismiss your device draft before editing the shared project.",
        );
      if (s.conflicts.length)
        throw new Error(
          "Resolve the overlapping edits first. Your draft is retained.",
        );
      if (same(s.files, s.base)) return;
      const snapshot = structuredClone(s.files);
      setStatus("Syncing with your team…");
      try {
        const result = await request("/api/team-lab", {
          projectId: s.projectId,
          expectedVersion: s.version,
          files: snapshot,
        });
        if (!live.current) return;
        if (result.conflict) {
          accept(result);
          throw new Error(
            "Overlapping edits need your review. Both versions are available below.",
          );
        }
        accept(result, snapshot);
      } catch (e) {
        if (live.current) setStatus(`Not synced: ${e.message}`);
        throw e;
      }
    });
  }
  flushRef.current = flush;
  useEffect(() => {
    live.current = true;
    state.current.ready = false;
    setReady(false);
    setError("");
    let cancelled = false;
    request("/api/team-lab")
      .then((result) => {
        if (cancelled) return;
        const s = state.current;
        Object.assign(s, {
          files: result.files,
          base: result.files,
          version: result.version,
          projectId: result.projectId,
          ready: true,
          conflicts: [],
          recoveryPending: false,
        });
        renderFiles(s.files);
        setMeta(result);
        setConflicts([]);
        setReady(true);
        setStatus("Team project synced");
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
          if (
            saved?.files &&
            saved.projectId === s.projectId &&
            !same(saved.files, s.files)
          ) {
            s.recoveryPending = true;
            setDraft(saved);
          }
        } catch {}
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setStatus(e.message);
        }
      });
    const protect = (e) => {
      const s = state.current;
      if (s.ready && (!same(s.files, s.base) || s.conflicts.length)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const register = (e) => {
      if (e.detail.ownerId === ownerId)
        e.detail.promises.push(flushRef.current());
    };
    window.addEventListener("beforeunload", protect);
    window.addEventListener("codewild:flush-work", register);
    return () => {
      cancelled = true;
      live.current = false;
      persist();
      window.removeEventListener("beforeunload", protect);
      window.removeEventListener("codewild:flush-work", register);
    };
  }, [ownerId, attempt]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false,
      timer,
      heartbeatAt = 0;
    async function poll() {
      if (cancelled) return;
      if (document.visibilityState === "visible" || backgroundSync.current) {
        try {
          await serialize(async () => {
            const s = state.current;
            const result = await request(`/api/team-lab?version=${s.version}`);
            if (cancelled) return;
            if (result.projectId !== s.projectId)
              throw new Error(
                "Your team changed. Download your draft and reopen the lab.",
              );
            setMeta((old) => ({ ...old, ...result, files: undefined }));
            if (result.files && !s.conflicts.length) accept(result);
            if (Date.now() - heartbeatAt > 15000) {
              await request("/api/team-lab", {
                action: "presence",
                projectId: s.projectId,
                path: activeRef.current,
              });
              heartbeatAt = Date.now();
            }
            if (!s.conflicts.length && same(s.files, s.base))
              setStatus("Team project synced");
          });
          if (
            !state.current.conflicts.length &&
            !same(state.current.files, state.current.base)
          )
            await flushRef.current();
        } catch (e) {
          if (!cancelled) setStatus(`Reconnecting: ${e.message}`);
        }
      }
      if (!cancelled) timer = setTimeout(poll, 2000);
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready]);
  useEffect(() => {
    if (!ready || conflicts.length || same(files, state.current.base)) return;
    const timer = setTimeout(() => flushRef.current().catch(() => {}), 800);
    return () => clearTimeout(timer);
  }, [files, ready, conflicts]);
  function resolve(path, useTeam) {
    const s = state.current;
    if (useTeam) {
      const next = { ...s.files };
      if (s.base[path] === undefined) delete next[path];
      else next[path] = s.base[path];
      setFiles(next);
    }
    s.conflicts = s.conflicts.filter((p) => p !== path);
    setConflicts([...s.conflicts]);
    persist();
    setStatus(
      s.conflicts.length
        ? "Review the remaining overlapping edits."
        : "Edits resolved. Syncing…",
    );
  }
  return {
    files,
    setFiles,
    ready,
    status,
    error,
    meta,
    conflicts,
    teamFiles: state.current.base,
    draft,
    flush,
    unsaved: !same(files, state.current.base),
    retry: () => setAttempt((n) => n + 1),
    resolve,
    recover: () => {
      if (draft) {
        const merged = recoverTeamDraft(draft, state.current.base);
        state.current.recoveryPending = false;
        state.current.conflicts = merged.conflicts;
        setConflicts(merged.conflicts);
        setFiles(merged.files);
        setDraft(null);
      }
    },
    dismissDraft: () => {
      state.current.recoveryPending = false;
      setDraft(null);
      persist();
    },
    loadRevision: (version) => request(`/api/team-lab?revision=${version}`),
    setBackgroundSync: (value) => {
      backgroundSync.current = value;
    },
    requestReview: async (feedback) => {
      await flush();
      return serialize(async () => {
        const s = state.current;
        if (!same(s.files, s.base))
          throw Error(
            "New edits are still syncing. Save them before requesting review.",
          );
        const result = await request("/api/team-lab", {
          action: "review",
          status: "REQUESTED",
          feedback,
          projectId: s.projectId,
          expectedVersion: s.version,
        });
        setMeta((old) => ({
          ...old,
          reviews: [
            result.review,
            ...(old.reviews || []).filter((r) => r._id !== result.review._id),
          ],
        }));
        return result;
      });
    },
  };
}
