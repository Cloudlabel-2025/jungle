"use client";
import fetch, { getActiveCollege } from "@/lib/college-fetch.js";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPipProgressClient, legacyPipProgress } from "@/lib/pip-progress-client.js";
import { completedPipSteps, emptyPipProgress, pipAccountKey } from "@/lib/pip-progress-rules.js";
import { pipScope } from "@/lib/pip-tutorial.js";

export default function usePipProgress(data) {
  const account = pipAccountKey(data), scope = pipScope(data), [, render] = useState(0);
  const imported = useRef("");
  const client = useMemo(() => createPipProgressClient(data.pipProgress || emptyPipProgress(), async (patch) => {
    const response = await fetch("/api/player/pip-progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account, ...patch }) });
    const saved = await response.json();
    if (!response.ok) throw Error(saved.error || "Kiko progress was not saved.");
    return saved;
  }), [account]);
  useEffect(() => {
    const unsubscribe = client.subscribe(() => render((n) => n + 1));
    client.start();
    return () => { unsubscribe(); client.stop(); };
  }, [client]);
  useEffect(() => { client.receive(data.pipProgress); }, [client, data.pipProgress]);
  useEffect(() => {
    try {
      const patch = getActiveCollege() ? {} : legacyPipProgress({ ...data, pipProgress: client.get() }, localStorage);
      if (imported.current === account) delete patch.following;
      client.patch(patch);
      imported.current = account;
    } catch { /* Account progress works without browser storage. */ }
  }, [client, scope]);
  const completed = JSON.stringify(completedPipSteps(data));
  useEffect(() => { client.patch({ completed: JSON.parse(completed) }); }, [client, completed]);
  return { ...client.get(), patch: client.patch, account };
}
