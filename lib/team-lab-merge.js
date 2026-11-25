import { diffArrays } from "diff";
export const sameTeamFiles = (a, b) => {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => a[key] === b[key])
  );
};

function edits(before, after) {
  const a = before.split(/(?<=\n)/),
    b = after.split(/(?<=\n)/);
  const diff = diffArrays(a, b, { timeout: 40 });
  if (!diff) return [{ start: 0, end: a.length, lines: b }];
  const result = [];
  let offset = 0,
    pending;
  for (const part of diff) {
    if (!part.added && !part.removed) {
      if (pending) result.push(pending);
      pending = null;
      offset += part.count;
    } else {
      pending ||= { start: offset, end: offset, lines: [] };
      if (part.removed) {
        offset += part.count;
        pending.end = offset;
      } else pending.lines.push(...part.value);
    }
  }
  if (pending) result.push(pending);
  return result;
}

export function mergeText(base, local, remote) {
  if (local === base || local === remote) return { value: remote };
  if (remote === base) return { value: local };
  if ([base, local, remote].some((s) => typeof s !== "string"))
    return { conflict: true };
  const left = edits(base, local),
    right = edits(base, remote);
  const unique = [...left];
  for (const r of right) {
    let duplicate = false;
    for (const l of left) {
      if (JSON.stringify(l) === JSON.stringify(r)) {
        duplicate = true;
        break;
      }
      // Insertions at the same location, or on a changed boundary, need review.
      if (
        l.start <= r.end &&
        r.start <= l.end &&
        (l.start === l.end ||
          r.start === r.end ||
          (l.start < r.end && r.start < l.end))
      )
        return { conflict: true };
    }
    if (!duplicate) unique.push(r);
  }
  const lines = base.split(/(?<=\n)/);
  for (const change of unique.sort((a, b) => b.start - a.start))
    lines.splice(change.start, change.end - change.start, ...change.lines);
  return { value: lines.join("") };
}

export function mergeTeamFiles(base, local, remote) {
  const files = {},
    conflicts = [];
  for (const path of new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(remote),
  ])) {
    const result = mergeText(base[path], local[path], remote[path]);
    if (result.conflict) {
      conflicts.push(path);
      if (local[path] !== undefined) files[path] = local[path];
    } else if (result.value !== undefined) files[path] = result.value;
  }
  return { files, conflicts };
}

export function recoverTeamDraft(draft, remote) {
  const merged = mergeTeamFiles(draft.base, draft.files, remote);
  merged.conflicts = [
    ...new Set([...(draft.conflicts || []), ...merged.conflicts]),
  ].filter((path) => draft.files[path] !== remote[path]);
  return merged;
}
