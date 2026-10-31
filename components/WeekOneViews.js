"use client";
import Link from "next/link";
import { weekOneNavigation } from "@/lib/week-one-catalog.js";
import {
  MyDay,
  Announcements,
  Games,
  Rules,
  Questions,
  Challenges,
  MyResults,
  Notifications,
  PublishedRecognition,
} from "./WeekOneLearner";
import {
  Configuration,
  StaffAnnouncements,
  Assessments,
  StaffChallenges,
  StaffRules,
  StaffDashboard,
  StaffResults,
} from "./WeekOneAdmin";
import Showcase from "./WeekOneShowcase";
import ExpeditionHeading from "./ExpeditionHeading";
import WeekOneAudit from "./WeekOneAudit";
import { RecoveryLearner, RecoveryStaff } from "./Recovery";
import { programmePath } from "@/lib/workspace-navigation.js";

export const hasWeekOneView = (role, screen) =>
  weekOneNavigation[role]?.some((n) => n[1] === screen);
export default function WeekOneView({ screen, data, act, now }) {
  const gamer = data.user.role === "GAMER",
    p = data.weekOneProgram;
  const route = weekOneNavigation[data.user.role].find((n) => n[1] === screen);
  if (!p || !route) return null;
  let content;
  const recoveryStage = Boolean(
    p.recovery?.policy &&
    p.days.some((d) => d.day === 5 && d.state === "CLOSED"),
  );
  if (gamer) {
    if (screen === "dashboard")
      content = <MyDay data={data} act={act} now={now} />;
    if (screen === "announcements")
      content = <Announcements data={data} act={act} />;
    if (screen === "games") content = <Games data={data} act={act} now={now} />;
    if (screen === "ask-mc") content = <Questions data={data} act={act} />;
    if (screen === "showcase")
      content = <Showcase data={data} act={act} now={now} />;
    if (screen === "challenges")
      content = <Challenges data={data} act={act} now={now} />;
    if (screen === "game-rules") content = <Rules data={data} act={act} />;
    if (screen === "results") content = <MyResults data={data} />;
  } else {
    if (screen === "dashboard")
      content = <StaffDashboard data={data} act={act} now={now} />;
    if (screen === "setup") content = <Configuration data={data} act={act} />;
    if (screen === "announcements")
      content = <StaffAnnouncements data={data} act={act} now={now} />;
    if (screen === "assessments")
      content = <Assessments data={data} act={act} />;
    if (screen === "questions")
      content = <Questions data={data} act={act} staff />;
    if (screen === "showcase")
      content = <Showcase data={data} act={act} now={now} staff />;
    if (screen === "challenges")
      content = <StaffChallenges data={data} act={act} />;
    if (screen === "behaviour" || screen === "rules-approvals")
      content = (
        <>
          <StaffRules data={data} act={act} />
          <WeekOneAudit />
        </>
      );
    if (screen === "rewards")
      content = (
        <>
          <Showcase data={data} act={act} now={now} staff />
          <StaffChallenges data={data} act={act} />
          <PublishedRecognition data={data} />
        </>
      );
    if (screen === "results") content = <StaffResults data={data} act={act} />;
  }
  if (gamer && recoveryStage && ["dashboard", "games"].includes(screen))
    content = null;
  return (
    <div className="week-one-views">
      <ExpeditionHeading
        code={route[0]}
        title={route[2]}
        subtitle="Week 1 · Discover, Explore, STORY, FIRE and Prove"
      />
      {gamer && <Notifications data={data} act={act} />}
      <nav
        className="tabs"
        aria-label="Week 1 programme"
        style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
      >
        {weekOneNavigation[data.user.role].map(([code, page, label]) => (
          <Link
            key={code}
            className={`btn small ${page === screen ? "primary" : ""}`}
            aria-current={page === screen ? "page" : undefined}
            href={programmePath(data.user.role, page)}
          >
            {label}
          </Link>
        ))}
      </nav>
      {gamer ? (
        (screen === "results" ||
          (recoveryStage && ["dashboard", "games"].includes(screen))) && (
          <RecoveryLearner data={data} act={act} now={now} screen={screen} />
        )
      ) : (
        <RecoveryStaff data={data} act={act} screen={screen} />
      )}
      {content}
    </div>
  );
}
