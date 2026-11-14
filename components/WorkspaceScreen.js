"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { Radio, ShieldCheck, Radar } from "lucide-react";
import { programmeScreen } from "@/lib/workspace-navigation.js";
import { useWorkspace } from "./WorkspaceContext";
import { Busy, Empty } from "./ui";
import WorkflowOverview from "./WorkflowOverview";
import SkyFlightMap from "./SkyFlightMap";
import CrashArrival from "./CrashArrival";
import { flightScreens } from "@/lib/flight-rules.js";

const GamerView = dynamic(() => import("./Views").then((m) => m.GamerView), {
  loading: () => <Busy label="Opening this page…" />,
});
const StaffView = dynamic(() => import("./Views").then((m) => m.StaffView), {
  loading: () => <Busy label="Opening this page…" />,
});
const CodeLab = dynamic(() => import("./CodeLab"), {
  loading: () => <Busy label="Opening the workshop…" />,
});
const NotificationInbox = dynamic(() => import("./NotificationInbox"), {
  loading: () => <Busy label="Opening notifications…" />,
});

export default function WorkspaceScreen({ screen }) {
  const { data, user, act, clock, notify, error, refresh } = useWorkspace();
  useEffect(() => {
    if (user?._id) void import("./Views").catch(() => {});
  }, [user?._id]);
  if (!data) {
    if (error)
      return (
        <Empty title="Your workspace couldn't be loaded">
          <p>{error}</p>
          <button className="btn" onClick={() => refresh(true)}>
            Try again
          </button>
        </Empty>
      );
    return null;
  }
  const role = user.role;
  if(data.story?.crashReady && !["notifications","week-one-ask-mc"].includes(screen))return <CrashArrival act={act}/>;
  if (data.story?.flight && (screen === "dashboard" || !flightScreens.has(screen) ||
      (!data.story.introComplete && !["week-one-ask-mc", "notifications"].includes(screen))))
    return <SkyFlightMap data={data} act={act} now={clock} />;
  if (data.story?.flight && screen === "week-one-games")
    return <SkyFlightMap data={data} act={act} now={clock} />;
  const squad = data.teams.find((team) => team._id === user.teamId);
  return (
    <>
      {!data.story?.flight && ["dashboard", "setup", "week-one"].includes(screen) &&
        !(role === "GAMER" && screen === "dashboard") && (
          <WorkflowOverview data={data} now={clock} />
        )}
      {role === "GAMER" &&
        screen !== "dashboard" &&
        programmeScreen(screen) === null && (
          <div className="field-brief" aria-label="Expedition briefing">
            <span>
              <Radio size={13} /> {squad?.name || "Your expedition"}
            </span>
            <span>
              <ShieldCheck size={13} />{" "}
              {
                (data.alumniMap || []).filter(
                  (entry) => entry.state === "CLEARED",
                ).length
              }
              /5 Alumni Connect keys
            </span>
            <Link href="/gamer/dashboard">
              <Radar size={13} /> Return to map
            </Link>
          </div>
        )}
      {screen === "notifications" ? (
        <NotificationInbox />
      ) : screen === "ide" ? (
        <CodeLab key={data.user._id} data={data} act={act} notify={notify} />
      ) : role === "GAMER" ? (
        <GamerView screen={screen} data={data} act={act} now={clock} />
      ) : (
        <StaffView screen={screen} data={data} act={act} now={clock} />
      )}
    </>
  );
}
