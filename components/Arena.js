"use client";
import { setActiveCollege, collegeStorageKey } from "@/lib/college-fetch.js";
import fetch from "@/lib/college-fetch.js";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Activity,
  Menu,
  Command,
  Check,
  AlertTriangle,
  X,
  Wifi,
  Hexagon,
  Volume2,
  VolumeX,
  Bell,
  Compass,
  UserRound,
  Clock3,
  CalendarDays,
} from "lucide-react";
import { navigation, prefix, personas } from "@/lib/catalog.js";
import { weekOneNavigation } from "@/lib/week-one-catalog.js";
import {
  workspaceNavigation,
  programmeScreen,
  legacyWorkspaceData,
} from "@/lib/workspace-navigation.js";
import { roleNames } from "@/lib/expedition";
import { league } from "@/lib/rules.js";
import { Avatar, Modal, HP, Badge } from "./ui";
import PlayerHeader from "./PlayerHeader";
import NavLogoutButton from "./NavLogoutButton";
import TrophyLeague, { TrophyLeagueChange } from "./TrophyLeague";
import PlayerProfile from "./PlayerProfile";
import AttendancePrompt from "./AttendancePrompt";
import { WorkspaceContext } from "./WorkspaceContext";
import TeamCompletionAnnouncements from "./LevelCompletion";
import ExperienceCelebration from "./ExperienceCelebration";
import CharacterPicker from "./CharacterPicker";
import AvatarPortrait from "./AvatarPortrait";
import { characterFor } from "@/lib/characters";
import { monitoringRequired, claimSignInNotice } from "@/lib/notifications.js";
import GameLoadingScreen, { useGameEntryLoading } from "./GameLoadingScreen";
import ExpeditionLogin from "./ExpeditionLogin";
import InitialPasswordChange from "./InitialPasswordChange";
import VowBrand, { VowEmblem } from "./VowBrand";
const icons = {
  CalendarDays,
  Compass,
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
  Bell,
};
export default function Arena({
  college,
  tenancy,
  screen,
  workspace,
  initialUser,
  initialTime,
  demo,
  children,
}) {
  setActiveCollege(college?.id);
  const router = useRouter();
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
  const [characterPicker, setCharacterPicker] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leagueOpen,setLeagueOpen] = useState(false);
  useEffect(()=>setLeagueOpen(false),[user?._id]);
  const [attendanceOpen,setAttendanceOpen]=useState(false);
  useEffect(()=>{setProfileOpen(false);setAttendanceOpen(false);},[user?._id]);
  const offset = useRef(0),
    busy = useRef(null),
    sessionGeneration = useRef(0),
    activeSession = useRef(!!initialUser),
    stateRequest = useRef(null);
  const lastBroadcast = useRef(null),
    broadcastInitialized = useRef(false),
    audio = useRef(null);
  const challengeInbox = useRef({ userId: null, ids: new Set() });
  const evaluatedSignIn = useRef(null);
  const role = user?.role || "GAMER";
  const playerMode = role === "GAMER";
  const flightMode = playerMode && (data?.story?.flight ?? user?.story?.flight ?? true);
  const showEntryLoading = useGameEntryLoading(user?.mustChangePassword ? null : user?._id, Boolean(data), error);
  useEffect(()=>{
    if(playerMode && (data?.story?.characterSelectionRequired || (data?.user && !data.user.avatar && !data.user.characterHidden))&&!flightMode&&!profileOpen&&!launcher)setCharacterPicker(true);
  },[data?.user?._id,data?.user?.avatarVersion,data?.story?.characterSelectionRequired,playerMode,flightMode,profileOpen,launcher]);
  const playerNavigation = useRef(null);
  const playerNavigationTrigger = useRef(null);
  useEffect(() => {
    if (!mobile || !user) return;
    const drawer = playerNavigation.current;
    const controls = () =>
      Array.from(
        drawer?.querySelectorAll("a[href],button:not(:disabled)") || [],
      );
    controls()[0]?.focus();
    function trap(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobile(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = controls(),
        first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      playerNavigationTrigger.current?.focus();
    };
  }, [playerMode, mobile, user?._id]);
  const nav = flightMode ? [
    ["F0", "dashboard", "Sky journey", "Compass"],
    ...(data?.story?.introComplete ? weekOneNavigation.GAMER.map(([code, page, label, icon]) => [code, page === "dashboard" ? "week-one" : `week-one-${page}`, label, icon]) : [["F1", "week-one-ask-mc", "Ask for help", "Radio"]]),
    ...(data?.story?.introComplete ? [["O1", "objectives", "Level objectives", "BookOpen"], ["C1", "calendar", "Calendar", "CalendarDays"]] : []),
    ["N1", "notifications", "Notifications", "Bell"],
  ] : workspaceNavigation(role, {
    includeManagement: tenancy && role !== "GAMER" &&
      (!Array.isArray(user?.permissions) || user.permissions.includes("roster:write")),
  });
  const weekOneMode = programmeScreen(screen) !== null;
  const current = screen === "college-management"
    ? ["CM", screen, role === "CENTRE_COMMAND" ? "Manage college" : "Manage players"]
    : weekOneMode
    ? weekOneNavigation[role].find((n) => n[1] === programmeScreen(screen)) ||
      nav.at(-1)
    : nav.find((n) => n[1] === screen) || nav[0];
  const notify = useCallback((message, type = "success", action = {}) => {
    setToast({ message, type, ...action });
  }, []);
  useEffect(() => {
    const session = data?.sessionKey;
    if (
      !session ||
      data.user.role !== "GAMER" ||
      evaluatedSignIn.current === session
    )
      return;
    evaluatedSignIn.current = session;
    let storage;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }
    const firstVisit = claimSignInNotice(session, storage);
    if (firstVisit && monitoringRequired(data))
      notify(
        "A Commander check-in is needed. Review your support notification and agree the next steps.",
        "warning",
        {
          href: "/gamer/notifications",
          label: "Open notifications",
          duration: 9000,
        },
      );
  }, [data?.sessionKey, data?.user.drops, notify]);
  useEffect(() => {
    if (!data || data.user.role !== "GAMER") return;
    const own = data.tasks.filter(
      (t) =>
        (t.challengeId || t.projectAttemptId) && t.assigneeId === data.user._id,
    );
    const previous = challengeInbox.current;
    if (previous.userId === data.user._id) {
      const added = own.filter((t) => !previous.ids.has(t._id));
      if (added.length)
        notify(
          `${added.length} new challenge ${added.length === 1 ? "task" : "tasks"} assigned to you. Open Objectives to start.`,
        );
    }
    challengeInbox.current = {
      userId: data.user._id,
      ids: new Set(own.map((t) => t._id)),
    };
  }, [data?.tasks, data?.user._id, notify]);
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
        if(force)stateRequest.current?.abort();
        await busy.current;
        if (
          !activeSession.current ||
          (!force && !stateRequest.current?.signal.aborted)
        )
          return;
      }
      const generation = sessionGeneration.current;
      const controller = new AbortController();
      let timedOut=false;
      const deadline=setTimeout(()=>{timedOut=true;controller.abort();},20000);
      stateRequest.current = controller;
      const pending = (async () => {
        try {
          const response = await fetch("/api/state", {
            cache: "no-store",
            signal: controller.signal,
          });
          const result = await response.json();
          if (
            controller.signal.aborted ||
            stateRequest.current !== controller ||
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
          if (result.code === "PASSWORD_CHANGE_REQUIRED") { setUser(previous => ({ ...previous, mustChangePassword: true })); setData(null); setError(""); return; }
          if (!response.ok) throw new Error(result.error);
          offset.current = new Date(result.serverTime).getTime() - Date.now();
          setData(result);
          setUser(result.user);
          setError("");
        } catch (e) {
          if (
            (timedOut || e.name !== "AbortError") &&
            stateRequest.current === controller &&
            generation === sessionGeneration.current
          )
            setError(timedOut?"Loading took too long. Please try again.":e.message);
        } finally {
          clearTimeout(deadline);
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
    if (!user || user.mustChangePassword) return;
    refresh();
    const balanceChanged = (event) => {
      if (event.detail?.source !== "workspace") refresh(true);
    };
    window.addEventListener("codewild:balance-changed", balanceChanged);
    // Mutations refresh immediately. Spread background reads across clients so
    // a class signing in together does not repeatedly hit the database in a burst.
    const interval = 10000 + Math.floor(Math.random() * 2000);
    const resume = () => { if(document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange",resume);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, interval);
    return () => {
      clearInterval(timer);
      window.removeEventListener("codewild:balance-changed", balanceChanged);
      document.removeEventListener("visibilitychange",resume);
    };
  }, [user?._id, user?.mustChangePassword, refresh]);
  useEffect(() => {
    const t = setInterval(
      () => setClock(new Date(Date.now() + offset.current)),
      1000,
    );
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.duration || 5500);
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
  function enterWorkspace(nextUser) {
    const destination = `/${prefix(nextUser.role)}/dashboard`;
    // Keep the already loaded app for a fresh sign-in to this workspace.
    // Role/persona switches still start an isolated workspace session.
    if (!user && workspace === prefix(nextUser.role)) {
      activeSession.current = true;
      setError("");
      setData(null);
      setUser(nextUser);
      setLauncher(false);
      setSwitching(false);
      router.replace(destination);
      return;
    }
    window.location.assign(destination);
  }
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
      enterWorkspace(result.user);
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
      window.dispatchEvent(
        new CustomEvent("codewild:balance-changed", {
          detail: { source: "workspace" },
        }),
      );
      if (message) notify(message);
      return result;
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
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Sign-out failed. Please try again.");
      }
      if (tenancy) { window.location.assign(college?.slug ? `/c/${college.slug}` : "/gamer/dashboard"); return; }
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
              .map((p) => ({
                ...p,
                ...data?.roster.find((member) => member._id === p._id),
              }))
              .filter(
                (p) =>
                  p.role === r &&
                  `${p.name} ${p.role === "GAMER" ? `${characterFor(p)?.name} ${characterFor(p)?.label}` : p.assignment}`
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
                  <Avatar name={p.name} player={p.role === "GAMER" ? { ...p, characterHidden: true } : p} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.role === "GAMER"
                        ? "Player · Character unknown until your expedition begins"
                        : p.assignment}
                    </small>
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
      <>
        <ExpeditionLogin
          college={college}
          tenancy={tenancy}
          demoAccess={demo ? launcherContent : null}
          onSignIn={async (values) => {
            const response = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(values),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Unable to sign in. Please try again.");
            if (tenancy) { window.location.assign(`/${prefix(result.user.role)}/dashboard`); return; }
            enterWorkspace(result.user);
          }}
        />
        {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
      </>
    );
  if (user.mustChangePassword) return <InitialPasswordChange college={college} user={user} onSignOut={logout} />;
  const squad = data?.teams.find((t) => t._id === user.teamId);
  const headerPlayer = data ? (flightMode ? data.user : legacyWorkspaceData(data).user) : user;
  return (
    <WorkspaceContext.Provider
      value={{ data, user, act, clock, notify, error, refresh }}
    >
      <div
        className={`arena ${role === "GAMER" ? "player-arena" : ""} ${flightMode ? "flight-arena" : ""} ${flightMode && ["dashboard", "week-one-games"].includes(screen) ? "sky-map-mode" : ""} ${flightMode || !(role === "GAMER" && screen === "dashboard") ? "field-mode" : ""} ${screen === "ide" ? "lab-mode" : ""} ${!flightMode && role === "GAMER" && screen === "dashboard" ? "expedition-mode" : ""}`}
        data-role={role}
        inert={showEntryLoading ? true : undefined}
      >
        {mobile && (
          <div className="sidebar-shade" onClick={() => setMobile(false)} />
        )}
        {playerMode && (
          <button
            ref={playerNavigationTrigger}
            className={`map-nav-toggle ${mobile ? "is-open" : ""}`}
            aria-label={
              mobile
                ? "Close expedition navigation"
                : "Open expedition navigation"
            }
            aria-expanded={mobile}
            aria-controls="workspace-navigation"
            onClick={() => setMobile((open) => !open)}
          >
            <VowEmblem decorative />
          </button>
        )}
        <aside
          ref={playerNavigation}
          id="workspace-navigation"
          className={`sidebar ${mobile ? "open" : ""}`}
          tabIndex={0}
          inert={playerMode && !mobile ? true : undefined}
          role={mobile ? "dialog" : undefined}
          aria-modal={mobile ? true : undefined}
          aria-label="Expedition navigation"
        >
          <Link
            href={`/${prefix(role)}/dashboard`}
            className="brand"
            aria-label="Voyage of Wilderness home"
            onClick={() => setMobile(false)}
          >
            <VowBrand />
          </Link>
          {playerMode && (
            <button
              className="icon-btn map-drawer-close"
              aria-label="Close navigation"
              onClick={() => setMobile(false)}
            >
              <X size={20} />
            </button>
          )}
          <div className="sidebar-scroll-area">
          <div className="sidebar-season">
            {college && <span className="eyebrow">{college.name}</span>}
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
                  className={`nav-item ${screen === path || (path === "week-one" && weekOneMode) ? "active" : ""}`}
                  aria-current={screen === path || (path === "week-one" && weekOneMode) ? "page" : undefined}
                  title={label}
                  aria-label={playerMode ? label : undefined}
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
          {playerMode && data && !flightMode && (
            <button
              className="btn character-nav-button"
              onClick={() => {
                setMobile(false);
                setCharacterPicker(true);
              }}
            >
              {characterFor(data.user) && <AvatarPortrait avatar={characterFor(data.user).avatar}
                alt=""
                width={36}
                height={36}
              />}
              {data.user.avatar ? "Customize avatar" : "Create my avatar"}
            </button>
          )}
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
                  <small>
                    {playerMode
                      ? flightMode ? "Roles begin in the jungle" : (data?.user || user).assignment || "Role assigned on jungle entry"
                      : user.assignment}
                  </small>
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
          </div>
          <div className="sidebar-account">
            <NavLogoutButton onClick={logout} busy={switching} />
          </div>
        </aside>
        <div className="workspace">
          <header
            className={`topbar ${role === "GAMER" ? "player-topbar" : ""}`}
          >
            <div className="breadcrumbs">
              <button
                className="icon-btn menu-toggle"
                ref={!playerMode ? playerNavigationTrigger : undefined}
                aria-label="Open navigation"
                aria-expanded={mobile}
                aria-controls="workspace-navigation"
                onClick={() => setMobile(true)}
              >
                <Menu size={20} />
              </button>
              {role === "GAMER" ? (
                <PlayerHeader player={headerPlayer} />
              ) : (
                <>
                  <Command size={16} />
                  <span>Expedition</span>
                  <strong>{current[2]}</strong>
                </>
              )}
            </div>
            <div className="topbar-right">
              {role === "GAMER" && (
                <PlayerHeader
                  player={headerPlayer}
                  part="rewards"
                  teamName={squad?.name}
                  onOpenLeague={()=>setLeagueOpen(true)}
                />
              )}
              {playerMode && <button className="icon-btn profile-trigger" aria-label="Open my profile" title="My profile" onClick={()=>setProfileOpen(true)}><UserRound size={18}/></button>}
              {playerMode && data?.playSession?.attendanceRequired!==false && <button className="icon-btn attendance-trigger" aria-label="Open clock-in and clock-out" title={data?.playSession?.state === "EXTRA" ? "Extra play · manage session" : data?.playSession?.state === "ACTIVE" ? "Clocked in · manage session" : "Clock in"} onClick={()=>setAttendanceOpen(true)}><Clock3 size={18}/></button>}
              {role !== "GAMER" && (
                <span className="server-clock">
                  <span className="status-dot" />
                  {time}
                  <small>IST</small>
                </span>
              )}
              <Link
                className="icon-btn notification-bell"
                href={`/${prefix(role)}/notifications`}
                aria-label={`Notifications (${data?.notifications?.unread || 0} unread)`}
                title="Notifications"
              >
                <Bell size={18} />
                {data?.notifications?.unread > 0 && (
                  <span aria-hidden="true">
                    {data.notifications.unread > 99
                      ? "99+"
                      : data.notifications.unread}
                  </span>
                )}
              </Link>
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
                  <Avatar name={user.name} player={flightMode ? { ...(data?.user || user), characterHidden: true } : data?.user || user} small />
                  <span>
                    {user.name}
                    <small>{role.replaceAll("_", " ")}</small>
                  </span>
                </button>
              )}
            </div>
          </header>
          {error && (
            <div className="connection-error">
              <AlertTriangle size={16} />
              {error}
              <button onClick={() => refresh(true)}>Retry</button>
            </div>
          )}
          <main id="main-content" className="main-content" data-screen={screen}>
            {children}
          </main>
          <footer className="workspace-footer">
            <span>
              <Wifi size={12} /> CAMP RADIO CONNECTED <i /> ASIA / KOLKATA
            </span>
            <span>EXPLORE. ADAPT. SURVIVE.</span>
            <span>Voyage of Wilderness · VOW © 2026</span>
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
        {characterPicker && data && !flightMode && (
          <CharacterPicker
            data={data}
            act={act}
            close={() => setCharacterPicker(false)}
          />
        )}
        {profileOpen && data && <PlayerProfile data={data} close={()=>setProfileOpen(false)} onChooseCharacter={()=>{setProfileOpen(false);setCharacterPicker(true);}}/>}
        {playerMode && data && !launcher && <AttendancePrompt key={data.user._id} data={data} act={act} now={clock} open={attendanceOpen} close={()=>setAttendanceOpen(false)}/>}
        {data && !launcher && !characterPicker && !flightMode && (
          <TeamCompletionAnnouncements
            key={`${data.user._id}:${data.user.teamId}`}
            data={data}
          />
        )}
        {toast && (
          <div
            role={
              toast.type === "error" || toast.type === "warning"
                ? "alert"
                : "status"
            }
            className={`toast ${toast.type}`}
          >
            <span>
              {toast.type === "error" || toast.type === "warning" ? (
                <AlertTriangle size={18} />
              ) : (
                <Check size={18} />
              )}
            </span>
            {toast.message}
            {toast.href && (
              <Link
                className="toast-action"
                href={toast.href}
                onClick={() => setToast(null)}
              >
                {toast.label}
              </Link>
            )}
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
      {showEntryLoading && <GameLoadingScreen onCancel={logout} flight={flightMode} />}
      {playerMode && data?.user?._id === user?._id && <><TrophyLeagueChange key={`league:${data.user._id}`} player={data.user} ready={!showEntryLoading && !launcher && !characterPicker && !profileOpen && !attendanceOpen && !leagueOpen} open={()=>setLeagueOpen(true)}/><ExperienceCelebration key={data.user._id} player={data.user} ready={!showEntryLoading && !launcher && !characterPicker && !profileOpen && !attendanceOpen && !leagueOpen} /></>}
      {leagueOpen && data && <Modal title="Trophy leagues" kicker="THE TROPHY HALL" close={()=>setLeagueOpen(false)} wide><TrophyLeague trophies={data.user.trophies}/></Modal>}
    </WorkspaceContext.Provider>
  );
}
