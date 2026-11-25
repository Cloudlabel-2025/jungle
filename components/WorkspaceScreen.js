"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Radio, ShieldCheck, Radar } from "lucide-react";
import { programmeScreen } from "@/lib/workspace-navigation.js";
import { useWorkspace } from "./WorkspaceContext";
import { Busy, Empty } from "./ui";
import WorkflowOverview from "./WorkflowOverview";
import PlayerObjectives from "./PlayerObjectives";
import { flightScreens } from "@/lib/flight-rules.js";
import FlightLockedPage from "./FlightLockedPage";
import CommandMissionBoard from "./CommandMissionBoard";

const GamerView = dynamic(() => import("./Views").then((m) => m.GamerView), {
  loading: () => <Busy label="Opening this page…" />,
});
const SkyFlightMap = dynamic(() => import("./SkyFlightMap"), { loading: () => <Busy label="Opening your flight…" /> });
const CrashArrival = dynamic(() => import("./CrashArrival"), { loading: () => <Busy label="Arriving at camp…" /> });
const StaffView = dynamic(() => import("./Views").then((m) => m.StaffView), {
  loading: () => <Busy label="Opening this page…" />,
});
const CodeLab = dynamic(() => import("./CodeLab"), {
  loading: () => <Busy label="Opening the workshop…" />,
});
const StaffTeamLab=dynamic(()=>import('./StaffTeamLab.js'),{loading:()=> <Busy label="Opening project reviews…"/>});
const NotificationInbox = dynamic(() => import("./NotificationInbox"), {
  loading: () => <Busy label="Opening notifications…" />,
});
const CohortCalendar = dynamic(() => import("./CohortCalendar"), { loading: () => <Busy label="Opening calendar…" /> });
const AttendanceRegister = dynamic(() => import("./AttendanceRegister"), { loading: () => <Busy label="Opening attendance…" /> });

export default function WorkspaceScreen({ screen, objectives, objectiveLevel }) {
  const { data, user, act, clock, notify, error, refresh } = useWorkspace();
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
  if (data.story?.flight && !flightScreens.has(screen)) return <FlightLockedPage />;
  if (data.story?.flight && (screen === "dashboard" || !flightScreens.has(screen) ||
      (!data.story.introComplete && !["week-one-ask-mc", "notifications"].includes(screen))))
    return <SkyFlightMap data={data} act={act} now={clock} />;
  if (data.story?.flight && screen === "week-one-games")
    return <SkyFlightMap data={data} act={act} now={clock} />;
  if (screen === "objectives" && role === "GAMER") return <PlayerObjectives key={user._id} levels={objectives || []} initialLevel={objectiveLevel} />;
  if (screen === "calendar") return <CohortCalendar key={user._id} />;
  if (screen === "attendance" && role !== "GAMER") return <AttendanceRegister key={user._id} />;
  const squad = data.teams.find((team) => team._id === user.teamId);
  return (
    <>
      {role !== "GAMER" && screen === "dashboard" && data.weekOneProgram && <CommandMissionBoard data={data}/>}
      {!data.story?.flight && ["dashboard", "setup", "week-one"].includes(screen) &&
        screen !== "dashboard" && (
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
        role==='GAMER'?<CodeLab key={data.user._id} data={data} act={act} notify={notify} />:<StaffTeamLab notify={notify}/>
      ) : role === "GAMER" ? (
        <GamerView screen={screen} data={data} act={act} now={clock} />
      ) : (
        <StaffView screen={screen} data={data} act={act} now={clock} />
      )}
    </>
  );
}
