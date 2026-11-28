"use client";
import fetch from "@/lib/college-fetch.js";

import { useEffect, useRef, useState } from "react";
import { mergeDraft } from "@/lib/draft-merge.js";

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
  onReconciled,
  attemptStartedAt,
  submittedAt,
}) {
  const [status, setStatus] = useState("");
  const saved = useRef(JSON.stringify(initialValue)),
    revision = useRef(initialVersion);
  const queue = useRef(Promise.resolve()),
    mounted = useRef(true),
    latest = useRef(null),
    flushRef = useRef(null);
  const boundOwner = useRef(ownerId);
  const conflict = useRef(null);
  latest.current = {
    value,
    enabled: enabled && ownerId === boundOwner.current,
    endpoint,
    ownerId,
    payload,
    buildBody,
    onSaved,
    onReconciled,
    attemptStartedAt,
    submittedAt,
  };
  const fromServer = (template, draft) => ({ ...template, answers:draft.answers, ...("board" in template ? {board:draft.gameState||{}} : {}), ...("labState" in template ? {labState:draft.labState||{}} : {}) });
  const showConflict = () => {
    if(!mounted.current || !conflict.current)return;
    const item=latest.current, savedConflict=conflict.current;
    const server=fromServer(item.value,savedConflict.result.draft);
    const comparison=mergeDraft(savedConflict.base,item.value,server);
    comparison.conflicts=comparison.conflicts.filter(entry=>entry.field!=="board"&&!entry.field.startsWith("board."));
    window.dispatchEvent(new CustomEvent("codewild:draft-conflict",{detail:{ownerId:item.ownerId,conflicts:comparison.conflicts,resolve:async choice=>{
      if(!mounted.current)throw Error("Return to this mission before resolving its saved answers.");
      const current=latest.current;
      const merged=mergeDraft(savedConflict.base,current.value,server,choice).value;
      if("board" in current.value)merged.board=current.value.board;
      revision.current=savedConflict.result.version;
      saved.current=JSON.stringify(server);
      conflict.current=null;
      current.onReconciled?.(merged);
      return flush(merged);
    }}}));
  };
  const flush = (override, { silentConflict = false, force = false } = {}) => {
    const item = latest.current;
    if (!item.enabled) return queue.current.catch(() => {});
    const snapshot = structuredClone(override ?? item.value),
      key = JSON.stringify(snapshot);
    const pending = queue.current
      .catch(() => {})
      .then(async () => {
        if(conflict.current){if(!silentConflict)showConflict();throw Error("Review the conflicting saved answers. Your current entries are kept here.");}
        if (key === saved.current && !force) return;
        if (mounted.current) setStatus("Saving draft…");
        const body = item.buildBody
          ? item.buildBody(snapshot, revision.current)
          : {
              ...item.payload,
              ...snapshot,
              ownerId: item.ownerId,
              draftVersion: revision.current,
            };
        const base=JSON.parse(saved.current);
        if(item.endpoint === "/api/week1/program/attempt-save" && base.answers && item.attemptStartedAt){
          body.draftBase={answers:base.answers,...("board" in base ? {gameState:base.board} : {}),...("labState" in base ? {labState:base.labState} : {})};
          body.attemptStartedAt=item.attemptStartedAt;
          body.baseSubmittedAt=item.submittedAt||null;
        }
        const response = await fetch(item.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        if(result.code === "ATTEMPT_DRAFT_CONFLICT" && result.draftConflict){
          conflict.current={base,result:result.draftConflict};
          showConflict();
        }
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
        let acknowledged=snapshot;
        if(result.mergedDraft && JSON.stringify(latest.current.value)===key){
          acknowledged=fromServer(snapshot,result.mergedDraft);
          if(mounted.current)item.onReconciled?.(acknowledged);
        }
        saved.current = JSON.stringify(acknowledged);
        if (mounted.current) {
          setStatus("Draft saved to your account");
          item.onSaved?.(acknowledged);
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
    const timer = setTimeout(() => flushRef.current(undefined,{silentConflict:true}).catch(() => {}), 800);
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
      // Attempt versions also cover changes from another editor. Only an
      // acknowledged save can advance this editor's baseline; otherwise the
      // next write must reconcile the remote answers rather than overwrite.
      if(latest.current.endpoint === "/api/week1/program/attempt-save" && latest.current.attemptStartedAt)return;
      if (Number.isSafeInteger(version) && JSON.stringify(latest.current.value) === saved.current)
        // A poll may have started before our latest successful save. Never
        // rewind its version or every following save will conflict forever.
        revision.current = Math.max(revision.current, version);
    },
  };
}
