import { mergePipProgress, PIP_STEPS } from "./pip-progress-rules.js";
import { pipScope } from "./pip-tutorial.js";

const combine = (a, b) => {
  const result = { ...a, ...b };
  for (const key of ["seen", "dismissed", "completed"])
    if (a[key] || b[key]) result[key] = [...new Set([...(a[key] || []), ...(b[key] || [])])];
  return result;
};
// A serial, retryable queue. Arrays are monotonic; later arrow preferences win.
export function createPipProgressClient(initial, send, timers = globalThis) {
  let confirmed = initial, pending = {}, inflight = {}, busy = false, active = false, retry = null, error = "";
  const listeners = new Set();
  const view = () => ({ ...mergePipProgress(mergePipProgress(confirmed, inflight), pending), error });
  const emit = () => listeners.forEach((listener) => listener());
  async function flush() {
    if (!active || busy || !Object.keys(pending).length) return;
    busy = true;
    inflight = pending; pending = {};
    try {
      const saved = await send({ generation: initial.generation, ...inflight });
      if (!saved || saved.generation !== initial.generation) throw Error("Kiko progress was not saved.");
      receive(saved, false);
      inflight = {}; error = "";
    } catch {
      pending = combine(inflight, pending); inflight = {};
      error = "Kiko's progress could not be saved. Retrying automatically…";
      if (active) retry = timers.setTimeout(() => { retry = null; flush(); }, 3000);
    } finally {
      busy = false; emit();
      if (active && !retry && !error) flush();
    }
  }
  function receive(saved, notify = true) {
    if (!saved || saved.generation !== initial.generation) return;
    const newer = (saved.version || 0) >= (confirmed.version || 0);
    const merged = mergePipProgress(confirmed, saved);
    confirmed = { ...merged, version: Math.max(confirmed.version || 0, saved.version || 0), following: newer ? saved.following : confirmed.following };
    if (notify) emit();
  }
  return {
    get: view, receive,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    start() { active = true; flush(); },
    stop() { active = false; timers.clearTimeout(retry); retry = null; },
    patch(update) {
      const current = view(), changes = {};
      for (const key of ["seen", "dismissed", "completed"]) {
        const added = (update[key] || []).filter((id) => PIP_STEPS.includes(id) && !current[key].includes(id));
        if (added.length) changes[key] = added;
      }
      if (typeof update.following === "boolean" && update.following !== current.following) changes.following = update.following;
      if (!Object.keys(changes).length) return;
      pending = combine(pending, changes); emit(); flush();
    },
  };
}

export function legacyPipProgress(data, storage) {
  if ((data.pipProgress?.generation || 1) !== 1) return {};
  const prefix = `codewild:pip:v1:${data.user._id}:${data.user.cohortId || "alpha"}:`, keys = new Set([pipScope(data)]), dismissed = [];
  for (let i = 0; i < (storage.length || 0); i++) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) keys.add(key);
  }
  let follow = false;
  for (const key of keys) {
    const value = storage.getItem(key);
    if (PIP_STEPS.includes(value)) dismissed.push(value);
    follow ||= storage.getItem(`${key}:follow`) === "true";
  }
  const travel = `codewild:pip:travel:v1:${JSON.stringify([data.user._id, data.user.cohortId || "alpha"])}`;
  if (storage.getItem(travel) === "seen") dismissed.push("travelling");
  return { seen: [...new Set(dismissed)], dismissed: [...new Set(dismissed)], ...(!data.pipProgress?.version && follow ? { following: true } : {}) };
}
