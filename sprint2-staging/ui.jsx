import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { fields, options, optional } from "./fields.mjs";

async function api(path, method = "GET", body) {
  const response = await fetch(`/api${path}`, {
    method,
    ...(body && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

function App() {
  const [viewer, setViewer] = useState(null);
  const [list, setList] = useState([]);
  const [profile, setProfile] = useState(null);
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(action) {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function enter(identity) {
    setViewer(identity);
    if (identity.role === "admin") setList(await api("/alumni"));
    else setProfile(await api(`/alumni/${identity.alumniId}`));
  }
  useEffect(() => {
    api("/session")
      .then((identity) => run(() => enter(identity)))
      .catch(() => {});
  }, []);
  return (
    <main>
      <h1>Alumni Connect</h1>
      <p>
        Sprint 2 staging candidate · Fictional Team A · CC acceptance pending
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {receipt && <p role="status">{receipt}</p>}
      {!viewer ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const credentials = Object.fromEntries(
              new FormData(event.currentTarget),
            );
            run(async () => enter(await api("/login", "POST", credentials)));
          }}
        >
          <h2>Sign in</h2>
          <label>
            Email{" "}
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            Password{" "}
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <button disabled={busy}>Sign in</button>
        </form>
      ) : (
        <>
          <p>
            Signed in as {viewer.role === "admin" ? "Administrator" : "Alumnus"}
          </p>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api("/logout", "POST");
                setViewer(null);
                setList([]);
                setProfile(null);
                setEditor(null);
                setReceipt("");
              })
            }
          >
            Sign out
          </button>
          {viewer.role === "admin" && !editor && (
            <section>
              <h2>Alumni directory ({list.length})</h2>
              <button
                onClick={() => {
                  setEditor({});
                  setReceipt("");
                }}
              >
                Create alumni
              </button>
              <ul>
                {list.map((record) => (
                  <li key={record._id}>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          setProfile(await api(`/alumni/${record._id}`));
                          setReceipt("");
                        })
                      }
                    >
                      {record.firstName} {record.lastName} · {record.email}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {profile && !editor && (
            <section>
              <h2>
                {profile.firstName} {profile.lastName}
              </h2>
              {viewer.role === "admin" && (
                <button
                  onClick={() => {
                    setEditor(profile);
                    setReceipt("");
                  }}
                >
                  Edit profile
                </button>
              )}
              <dl>
                <dt>Alumni ID</dt>
                <dd>{profile._id}</dd>
                {fields.map(([key, label]) => (
                  <React.Fragment key={key}>
                    <dt>{label}</dt>
                    <dd>{profile[key] || "—"}</dd>
                  </React.Fragment>
                ))}
                <dt>Created</dt>
                <dd>{profile.createdAt}</dd>
                <dt>Modified</dt>
                <dd>{profile.modifiedAt}</dd>
              </dl>
            </section>
          )}
          {editor && viewer.role === "admin" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const values = Object.fromEntries(
                  new FormData(event.currentTarget),
                );
                run(async () => {
                  const record = await api(
                    editor._id ? `/alumni/${editor._id}` : "/alumni",
                    editor._id ? "PUT" : "POST",
                    values,
                  );
                  setProfile(record);
                  setEditor(null);
                  setReceipt(`Saved ${record._id}.`);
                  setList(await api("/alumni"));
                });
              }}
            >
              <h2>{editor._id ? "Edit profile" : "Create alumni"}</h2>
              <fieldset disabled={busy}>
                {fields.map(([key, label, type = "text"]) => (
                  <label key={key}>
                    {label}{" "}
                    {options[key] ? (
                      <select
                        name={key}
                        defaultValue={editor[key] || ""}
                        required
                      >
                        <option value="">Select…</option>
                        {options[key].map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={key}
                        type={type}
                        defaultValue={editor[key] || ""}
                        required={!optional.includes(key)}
                        maxLength={key === "linkedin" ? 500 : 254}
                      />
                    )}
                  </label>
                ))}
                <button>Save profile</button>
                <button type="button" onClick={() => setEditor(null)}>
                  Cancel
                </button>
              </fieldset>
            </form>
          )}
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
