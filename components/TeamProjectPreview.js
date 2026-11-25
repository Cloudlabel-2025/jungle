"use client";
import { useEffect, useRef, useState } from "react";
import fetch from "@/lib/college-fetch.js";
import { labDocument } from "@/lib/lab-runtime.js";
export default function TeamProjectPreview({ files }) {
  const [doc, setDoc] = useState(""),
    [error, setError] = useState(""),
    frame = useRef(),
    runId = useRef();
  useEffect(() => {
    let live = true;
    Promise.all([
      fetch("/vendor/lab-runtime.js").then((r) => {
        if (!r.ok) throw Error("Preview runtime unavailable.");
        return r.text();
      }),
      import("@babel/standalone"),
    ])
      .then(([runtime, imported]) => {
        const babel = imported.default || imported;
        const source = files["src/App.jsx"].replace(
          /^import\s+React\s+from\s+['"]react['"];?\s*$/m,
          "",
        );
        const code = babel.transform(source, {
          filename: "App.jsx",
          presets: [["env", { modules: "commonjs" }], "react"],
        }).code;
        if (live) {
          runId.current = crypto.randomUUID();
          setDoc(
            labDocument({
              runtime,
              code,
              css: files["src/styles.css"],
              runId: runId.current,
            }),
          );
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    const receive = (e) => {
      if (
        e.source === frame.current?.contentWindow &&
        e.data?.runId === runId.current &&
        e.data?.type === "error"
      )
        setError(String(e.data.payload));
    };
    window.addEventListener("message", receive);
    return () => {
      live = false;
      window.removeEventListener("message", receive);
    };
  }, [files]);
  return (
    <>
      {error && (
        <p className="team-lab-error" role="alert">
          {error} Download this version to run its full dependencies locally.
        </p>
      )}
      {doc ? (
        <iframe
          ref={frame}
          title="Reviewed project preview"
          sandbox="allow-scripts"
          srcDoc={doc}
        />
      ) : (
        <p>Preparing preview…</p>
      )}
    </>
  );
}
