"use client";
import { useEffect, useState } from "react";
import fetch from "@/lib/college-fetch.js";
export default function LocalLabRunner({ work, notify }) {
  const [busy, setBusy] = useState(false),
    [connections, setConnections] = useState([]);
  async function request(body) {
    const r = await fetch(
      body ? "/api/team-lab" : "/api/team-lab?view=local-connections",
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : { cache: "no-store" },
    );
    const result = await r.json();
    if (!r.ok)
      throw Error(result.error || "Local connection could not be created.");
    return result;
  }
  async function refresh() {
    try {
      setConnections((await request()).connections);
    } catch {}
  }
  useEffect(() => {
    if (!work.ready) return;
    let live = true,
      timer;
    const poll = async () => {
      if (!live) return;
      await refresh();
      if (live) timer = setTimeout(poll, 10000);
    };
    poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [work.ready, work.meta.projectId]);
  async function download() {
    setBusy(true);
    try {
      await work.flush();
      const response = await fetch("/vendor/local-code-sync.mjs");
      if (!response.ok)
        throw Error(
          "The local sync runner is unavailable. Run the app prepare step.",
        );
      const source = await response.text();
      const { config } = await request({
        action: "local-connect",
        projectId: work.meta.projectId,
      });
      const { zipSync, strToU8 } = await import("fflate");
      const url = URL.createObjectURL(
        new Blob(
          [
            zipSync({
              ".vow-sync.mjs": strToU8(source),
              ".vow-sync-config.json": strToU8(JSON.stringify(config, null, 2)),
            }),
          ],
          { type: "application/zip" },
        ),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "wilderness-local-connection.zip";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      await refresh();
      notify(
        "Local connection package downloaded. Extract it into a dedicated project folder and run the command below.",
      );
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="team-local-runner">
      <h3>Sync with your local editor</h3>
      <p>
        Download a connection package, extract it into a dedicated project
        folder and run <code>node .vow-sync.mjs</code> with Node.js 22 or later.
        Source then syncs automatically while the runner is running, even when
        this browser is closed.
      </p>
      <button
        className="btn small"
        disabled={
          busy ||
          !work.ready ||
          Boolean(work.draft) ||
          work.conflicts.length > 0
        }
        onClick={download}
      >
        {busy ? "Preparing connection…" : "Download local sync connection"}
      </button>
      <small>
        The connection lasts 12 hours, accesses only your current team’s source
        and can be disconnected below. Connection files are excluded from local
        Git commits. Use one sync method per folder.
      </small>
      {connections.map((c) => (
        <div className="team-runner-connection" key={c._id}>
          <span>
            {c.lastSeenAt
              ? `Last sync: ${new Date(c.lastSeenAt).toLocaleTimeString()}`
              : "Waiting for local runner"}{" "}
            · expires {new Date(c.expiresAt).toLocaleTimeString()}
          </span>
          <button
            className="btn small"
            onClick={async () => {
              try {
                await request({ action: "local-disconnect", grantId: c._id });
                await refresh();
                notify("Local runner disconnected. Its files are retained.");
              } catch (e) {
                notify(e.message, "error");
              }
            }}
          >
            Disconnect local runner
          </button>
        </div>
      ))}
    </div>
  );
}
