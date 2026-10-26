"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  BookOpen,
  Columns3,
  Radio,
  NotebookPen,
  Trophy,
  SquareTerminal,
  Radar,
  HeartPulse,
  Award,
  Network,
  ShieldCheck,
  Zap,
  FileBarChart,
  Flame,
  Activity,
  Menu,
  Command,
  LogOut,
  Check,
  AlertTriangle,
  X,
  Wifi,
  Hexagon,
  Volume2,
  VolumeX,
} from "lucide-react";
import { navigation, prefix, personas } from "@/lib/catalog.js";
import { roleNames } from "@/lib/expedition";
import { league } from "@/lib/rules.js";
import { Avatar, Modal, HP, Busy, Badge } from "./ui";
import { GamerView, StaffView } from "./Views";
import CodeLab from "./CodeLab";
import PlayerStatus from "./PlayerStatus";
const icons = {
  LayoutDashboard,
  BookOpen,
  Columns3,
  Radio,
  NotebookPen,
  Trophy,
  SquareTerminal,
  Radar,
  HeartPulse,
  Award,
  Network,
  ShieldCheck,
  Zap,
  FileBarChart,
};
export default function Arena({
  screen,
  workspace,
  initialUser,
  initialTime,
  demo,
}) {
  const [user, setUser] = useState(initialUser),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(null),
    [launcher, setLauncher] = useState(false),
    [search, setSearch] = useState(""),
    [mobile, setMobile] = useState(false),
    [clock, setClock] = useState(new Date(initialTime)),
    [accessCode, setAccessCode] = useState(""),
    [switching, setSwitching] = useState(false),
    [soundEnabled, setSoundEnabled] = useState(false);
  const offset = useRef(0),
    busy = useRef(null),
    sessionGeneration = useRef(0),
    activeSession = useRef(!!initialUser),
    stateRequest = useRef(null);
  const lastBroadcast = useRef(null),
    broadcastInitialized = useRef(false),
    audio = useRef(null);
  const role = user?.role || "GAMER";
  const nav = navigation[role];
  const current = nav.find((n) => n[1] === screen) || nav[0];
  const notify = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);
  useEffect(() => {
    if (!data) return;
    const event = data?.events[0];
    if (!broadcastInitialized.current) {
      broadcastInitialized.current = true;
      lastBroadcast.current = event?._id || null;
      return;
    }
    if (!event) return;
    if (lastBroadcast.current !== event._id) {
      notify(`Client change: ${event.title}`, "error");
      if (soundEnabled && audio.current) {
        const context = audio.current;
        context
          .resume()
          .then(() => {
            for (let i = 0; i < 2; i++) {
              const oscillator = context.createOscillator(),
                gain = context.createGain();
              oscillator.connect(gain);
              gain.connect(context.destination);
              oscillator.frequency.value = i ? 660 : 440;
              gain.gain.value = 0.06;
              oscillator.start(context.currentTime + i * 0.22);
              oscillator.stop(context.currentTime + i * 0.22 + 0.14);
            }
          })
          .catch(() => {});
      }
    }
    lastBroadcast.current = event._id;
  }, [Boolean(data), data?.events[0]?._id, soundEnabled, notify]);
  const refresh = useCallback(
    async (force = false) => {
      if (!activeSession.current) return;
      if (busy.current) {
        await busy.current;
        if (
          !activeSession.current ||
          (!force && !stateRequest.current?.signal.aborted)
        )
          return;
      }
      const generation = sessionGeneration.current;
      const controller = new AbortController();
      stateRequest.current = controller;
      const pending = (async () => {
        try {
          const response = await fetch("/api/state", {
            cache: "no-store",
            signal: controller.signal,
          });
          const result = await response.json();
          if (
            generation !== sessionGeneration.current ||
            !activeSession.current
          )
            return;
          if (response.status === 401) {
            activeSession.current = false;
            setUser(null);
            setData(null);
            setError("");
            setLauncher(false);
            notify(
              "Your session ended. Choose a persona to reconnect.",
              "error",
            );
            return;
          }
          if (!response.ok) throw new Error(result.error);
          offset.current = new Date(result.serverTime).getTime() - Date.now();
          setData(result);
          setUser(result.user);
          setError("");
        } catch (e) {
          if (
            e.name !== "AbortError" &&
            generation === sessionGeneration.current
          )
            setError(e.message);
        }
      })();
      busy.current = pending;
      try {
        await pending;
      } finally {
        if (busy.current === pending) busy.current = null;
      }
    },
    [notify],
  );
  useEffect(
    () => () => {
      sessionGeneration.current++;
      stateRequest.current?.abort();
      audio.current?.close().catch(() => {});
    },
    [],
  );
  useEffect(() => {
    if (!user) return;
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 6000);
    return () => clearInterval(timer);
  }, [user?._id, refresh]);
  useEffect(() => {
    const t = setInterval(
      () => setClock(new Date(Date.now() + offset.current)),
      1000,
    );
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    function key(e) {
      if (e.key === "Escape") {
        setLauncher(false);
        setMobile(false);
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  async function login(p) {
    setSwitching(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: p.email, accessCode }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      window.location.assign(`/${prefix(result.user.role)}/dashboard`);
    } catch (e) {
      notify(e.message, "error");
      setSwitching(false);
    }
  }
  async function act(route, body, message = "Action recorded by the server.") {
    try {
      const r = await fetch(`/api/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      await refresh(true);
      notify(message);
      return true;
    } catch (e) {
      notify(e.message, "error");
      return false;
    }
  }
  async function logout() {
    if (switching) return;
    setSwitching(true);
    activeSession.current = false;
    sessionGeneration.current++;
    stateRequest.current?.abort();
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("Sign-out failed. Please try again.");
      setUser(null);
      setData(null);
      setError("");
      setLauncher(false);
      setSoundEnabled(false);
      lastBroadcast.current = null;
      broadcastInitialized.current = false;
      await audio.current?.close();
      audio.current = null;
    } catch (e) {
      activeSession.current = true;
      notify(e.message, "error");
      void refresh(true);
    } finally {
      setSwitching(false);
    }
  }
  const time = clock.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const launcherContent = (
    <>
      <p className="muted">
        Every explorer has a story. Choose a member of your party, your Guide,
        or the Expedition Council.
      </p>
      <input
        className="search-input"
        aria-label="Search personas"
        placeholder="Find an explorer, guide, or council lead…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <label className="access-label">
        Expedition access code <span className="muted">(if configured)</span>
        <input
          type="password"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="persona-list">
        {["GAMER", "MISSION_COMMANDER", "CENTRE_COMMAND"].map((r) => (
          <div key={r}>
            <span className="eyebrow persona-group">
              {roleNames[r]} / {personas.filter((p) => p.role === r).length}
            </span>
            {personas
              .filter(
                (p) =>
                  p.role === r &&
                  `${p.name} ${p.assignment}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((p) => (
                <button
                  disabled={switching}
                  onClick={() => login(p)}
                  className="persona-row"
                  key={p._id}
                >
                  <Avatar name={p.name} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.assignment}</small>
                  </span>
                  {user?._id === p._id && <Check size={17} />}
                </button>
              ))}
          </div>
        ))}
      </div>
    </>
  );
  if (!user)
    return (
      <div className="entry">
        <div className="entry-brand">
          <span className="brand">
            <Flame size={30} />
            CODE<span>WILD</span>
            <i />
          </span>
          <span className="eyebrow">AN EXPEDITION BEYOND THE ORDINARY</span>
          <h1>
            Lost in the wild.
            <br />
            <em>Found in each other.</em>
          </h1>
          <p>
            Five explorers. A forgotten jungle. The only way home is through
            it—together.
          </p>
          <div className="entry-coordinates">
            12.9716° N / 77.5946° E <span>ALPHA COHORT / 2026</span>
          </div>
        </div>
        <div className="entry-login">
          <Badge tone="lime">
            <span className="status-dot" />
            THE EXPEDITION AWAITS
          </Badge>
          <h2>Choose your explorer.</h2>
          {demo ? (
            launcherContent
          ) : (
            <p>
              Persona login is disabled. This deployment needs an identity
              provider before users can sign in. For a private simulation,
              configure DEMO_MODE and an access code.
            </p>
          )}
        </div>
        {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
      </div>
    );
  const squad = data?.teams.find((t) => t._id === user.teamId);
  return (
    <div
      className={`arena ${!(role === "GAMER" && screen === "dashboard") ? "field-mode" : ""} ${screen === "ide" ? "lab-mode" : ""} ${role === "GAMER" && screen === "dashboard" ? "expedition-mode" : ""}`}
    >
      {mobile && (
        <div className="sidebar-shade" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Link
          href={`/${prefix(role)}/dashboard`}
          className="brand"
          aria-label="CODEWILD home"
        >
          <Flame size={27} />
          CODE<span>WILD</span>
          <i />
        </Link>
        <div className="sidebar-season">
          <span className="eyebrow">
            {data?.cohort.name.toUpperCase() || "ARENA COHORT"}
          </span>
          <div>
            <span className="status-dot" />
            EXPEDITION LIVE{" "}
            <span className="season-week">
              W{String(data?.cohort.currentWeek || 1).padStart(2, "0")}
            </span>
          </div>
        </div>
        <span className="nav-label">
          {role === "GAMER"
            ? "YOUR EXPEDITION"
            : role === "MISSION_COMMANDER"
              ? "GUIDE’S LOOKOUT"
              : "EXPEDITION COUNCIL"}
        </span>
        <nav aria-label="Workspace">
          {nav.map(([code, path, label, icon]) => {
            const Icon = icons[icon];
            return (
              <Link
                onClick={() => setMobile(false)}
                href={`/${prefix(role)}/${path}`}
                className={`nav-item ${screen === path ? "active" : ""}`}
                title={label}
                aria-label={
                  role === "GAMER" && screen === "dashboard" ? label : undefined
                }
                key={code}
              >
                <Icon size={18} />
                <span>{label}</span>
                <small>{code}</small>
                {screen === path && <i />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="field-note">
            <ShieldCheck size={20} />
            <span>
              Read the wild.
              <br />
              <strong>Leave no one behind.</strong>
            </span>
          </div>
          <div className="squad-card">
            <span className="eyebrow">
              {squad ? "YOUR PARTY" : "YOUR CLEARANCE"}
            </span>
            <div>
              <span className="squad-mark">{squad?.code || "CMD"}</span>
              <span>
                <strong>{squad?.name || roleNames[role]}</strong>
                <small>{user.assignment}</small>
              </span>
            </div>
          </div>
          <div className="sidebar-footer">
            <span>
              <span className="status-dot" />
              CAMP SIGNAL ACTIVE
            </span>
            <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className={`topbar ${role === "GAMER" ? "player-topbar" : ""}`}>
          <div className="breadcrumbs">
            <button
              className="icon-btn menu-toggle"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <Command size={16} />
            <span>Expedition</span>

            <strong>{current[2]}</strong>
          </div>
          {role === "GAMER" && data && <PlayerStatus player={data.user} />}
          <div className="topbar-right">
            {role !== "GAMER" && (
              <span className="server-clock">
                <span className="status-dot" />
                {time}
                <small>IST</small>
              </span>
            )}
            <button
              className="icon-btn sound-toggle"
              aria-label={
                soundEnabled
                  ? "Mute client alerts"
                  : "Enable client alert sound"
              }
              title={
                soundEnabled
                  ? "Mute client alerts"
                  : "Enable client alert sound"
              }
              onClick={() => {
                if (!audio.current) {
                  const Audio =
                    window.AudioContext || window.webkitAudioContext;
                  if (!Audio) {
                    notify(
                      "Audio alerts are unavailable in this browser.",
                      "error",
                    );
                    return;
                  }
                  audio.current = new Audio();
                }
                audio.current
                  .resume()
                  .catch(() =>
                    notify(
                      "Audio could not be enabled. Try the speaker control again.",
                      "error",
                    ),
                  );
                setSoundEnabled((v) => !v);
              }}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            {demo && (
              <button
                className="persona-trigger"
                aria-label={`Switch persona · ${user.name}`}
                onClick={() => setLauncher(true)}
              >
                <Avatar name={user.name} small />
                <span>
                  {user.name}
                  <small>{role.replaceAll("_", " ")}</small>
                </span>
              </button>
            )}
            <button
              className="icon-btn logout"
              title="Sign out"
              aria-label="Sign out"
              disabled={switching}
              onClick={logout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        {error && (
          <div className="connection-error">
            <AlertTriangle size={16} />
            {error}
            <button onClick={refresh}>Retry</button>
          </div>
        )}
        {data?.events[0] && (
          <div className="broadcast-banner">
            <Zap size={17} />
            <strong>JUNGLE DISPATCH</strong>
            <span>
              {data.events[0].title} · {data.events[0].description}
            </span>
            <small>
              {new Date(data.events[0].broadcastAt).toLocaleTimeString(
                "en-GB",
                { timeZone: "Asia/Kolkata" },
              )}{" "}
              IST
            </small>
          </div>
        )}
        {data?.roster.some(
          (u) => u.drops >= 3 && (role !== "GAMER" || u.teamId === user.teamId),
        ) && (
          <div className="warning-banner">
            <AlertTriangle size={17} />
            Support alert:{" "}
            {data.roster
              .filter(
                (u) =>
                  u.drops >= 3 &&
                  (role !== "GAMER" || u.teamId === user.teamId),
              )
              .map((u) => u.name)
              .join(", ")}{" "}
            reached three consecutive HP drops. A Commander check-in is needed.
          </div>
        )}
        {data?.rescues.some(
          (r) => r.status !== "CLOSED" && r.userId === user._id,
        ) && (
          <div className="warning-banner">
            RESCUE PROTOCOL ACTIVE · Your mission continues. Work with your
            Commander on a remediation plan.
          </div>
        )}
        <main id="main-content" className="main-content" data-screen={screen}>
          {data && role === "GAMER" && screen !== "dashboard" && (
            <div className="field-brief" aria-label="Expedition briefing">
              <span>
                <Radio size={13} /> {squad?.name || "Your expedition"}
              </span>
              <span>
                <ShieldCheck size={13} />{" "}
                {data.progress.filter((p) => p.userId === data.user._id).length}
                /{data.modules.length} encounters cleared
              </span>
              <Link href="/gamer/dashboard">
                <Radar size={13} /> Return to map
              </Link>
            </div>
          )}
          {!data ? (
            <Busy />
          ) : screen === "ide" ? (
            <CodeLab data={data} act={act} notify={notify} />
          ) : role === "GAMER" ? (
            <GamerView screen={screen} data={data} act={act} now={clock} />
          ) : (
            <StaffView screen={screen} data={data} act={act} now={clock} />
          )}
        </main>
        <footer className="workspace-footer">
          <span>
            <Wifi size={12} /> CAMP RADIO CONNECTED <i /> ASIA / KOLKATA
          </span>
          <span>EXPLORE. ADAPT. SURVIVE.</span>
          <span>CODEWILD © 2026</span>
        </footer>
      </div>
      {launcher && (
        <Modal
          title="Switch persona"
          kicker="29 PERSONAS / FIVE EXPEDITIONS"
          close={() => setLauncher(false)}
        >
          {launcherContent}
        </Modal>
      )}
      {toast && (
        <div role="status" className={`toast ${toast.type}`}>
          <span>
            {toast.type === "error" ? (
              <AlertTriangle size={18} />
            ) : (
              <Check size={18} />
            )}
          </span>
          {toast.message}
          <button
            className="icon-btn"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
