"use client";
import Link from "next/link";
import { Check, LockKeyhole, ArrowRight } from "lucide-react";
import { Modal } from "./ui";
import { MyDay, Questions, Rules, MyResults } from "./WeekOneLearner";
import { DayOneRewards } from "./DayOneFeatures";
import Showcase from "./WeekOneShowcase";
import { LevelOneStarGuideContent } from "./LevelOneStarGuide";
import FlightJourneyStatus from "./FlightJourneyStatus";
import TrophyLeague from "./TrophyLeague";

const titles = {
  checkin: "Daily check-in",
  next: "Your next steps",
  work: "My flight work",
  showcase: "Research Showcase",
  help: "Help Desk",
  levels: "Flight levels",
  rewards: "My rewards",
  rules: "Game rules",
  "star-guide": "How to earn 3 stars",
};
export default function SkyMapPanels({
  panel,
  close,
  open,
  data,
  act,
  now,
  levels,
  discovery,
  onFly,
}) {
  if (!panel) return null;
  const prepared = Boolean(data.weekOneProgram?.days?.length);
  const boarded = data.story.introComplete;
  const fly = (day) => {
    close();
    onFly(day);
  };
  const levelList = (
    <div className="sky-level-list">
      {levels.map((level) => (
        <div className="sky-level-row" key={level.day}>
          <span>
            {level.available ? <Check size={20} /> : <LockKeyhole size={20} />}
          </span>
          <div>
            <strong>
              Level {level.day} · {level.title}
            </strong>
            <p>{level.status}</p>
          </div>
          <button
            className="btn small"
            disabled={!level.available}
            onClick={() => fly(level.day)}
          >
            {level.available ? "Fly here" : "Locked"}
            <ArrowRight size={14} />
          </button>
        </div>
      ))}
    </div>
  );
  const needsBoarding =
    ["checkin", "work", "showcase"].includes(panel) && !boarded;
  return (
    <Modal
      title={titles[panel]}
      kicker="FLIGHT / MAP EQUIPMENT"
      wide
      close={close}
    >
      <div className="sky-equipment-panel">
        {needsBoarding ? (
          <>
            <p>
              Board your first mission before checking in or beginning your
              flight activities.
            </p>
            <button
              className="btn primary"
              disabled={!levels[0].available}
              onClick={() => fly(1)}
            >
              Fly to Level 1
            </button>
          </>
        ) : !prepared && !["levels", "next", "star-guide"].includes(panel) ? (
          <p>
            Your programme is being prepared. Your MC can help with release and
            check-in questions.
          </p>
        ) : (
          <>
            {panel === "checkin" && <MyDay data={data} act={act} />}
            {panel === "levels" && (
              <>
                <p>
                  Choose a released destination. Your helicopter arrives before
                  its mission opens.
                </p>
                {levelList}
              </>
            )}
            {panel === "next" && (
              <>
                <FlightJourneyStatus levels={levels} program={data.weekOneProgram} />
                <p>
                  Follow your daily briefing, then complete the released
                  mission. Flight itself does not start your research timer.
                </p>
                <div className="button-row">
                  <button className="btn" onClick={() => open("checkin")}>
                    Check-in & reflections
                  </button>
                  <Link className="btn" href="/gamer/week-one-announcements">
                    Read MC briefing
                  </Link>
                  <button className="btn" onClick={() => open("rules")}>
                    Game rules
                  </button>
                </div>
                <h3>First discovery · {discovery.completed}/{discovery.steps.length} checkpoints</h3>
                <ol className="sky-next-checklist">
                  {discovery.steps.map((step) => (
                    <li key={step.id}>
                      {step.done ? <Check size={16} /> : <span>○</span>}
                      {step.title} · {step.done ? "Saved" : "To do"}
                    </li>
                  ))}
                </ol>
                {levelList}
              </>
            )}
            {panel === "work" && (
              <>
                <p>
                  Enter your available level to continue its saved work. Future
                  missions stay locked until released.
                </p>
                {levelList}
                <div className="button-row">
                  <Link className="btn" href="/gamer/week-one-announcements">
                    Meeting announcements
                  </Link>
                  <button className="btn" onClick={() => open("rewards")}>
                    My results & rewards
                  </button>
                </div>
              </>
            )}
            {panel === "showcase" && (
              <>
                <p>
                  Your Week 1 Showcase groups are separate from the five-person
                  research groups. This space uses your published Showcase
                  arrangements.
                </p>
                <Showcase data={data} act={act} now={now} />
              </>
            )}
            {panel === "help" && (
              <>
                <div className="button-row">
                  <button className="btn" onClick={() => open("rules")}>
                    Read game rules
                  </button>
                  <button className="btn" onClick={() => open("star-guide")}>
                    How to earn 3 stars
                  </button>
                  <Link className="btn" href="/gamer/notifications">
                    Notifications
                  </Link>
                </div>
                <Questions data={data} act={act} />
              </>
            )}
            {panel === "rules" && (
              <>
                <p>First attempts, saving and submitting are free. After a timer ends or a level is completed, retry the whole level for 1 energy and fresh mission timers. Retry charges do not remove lives or count as conduct penalties. Improve your best stars for 3 extra trophies; equal or lower stars earn no extra trophies. Completed retries earn 25% XP. Your first earned stars on a level still receive normal trophies. Wrong answers and asking for help are free. Confirmed rule breaches retain their recorded penalties. Help Desk offers energy recovery when your retry balance is empty.</p>
                {!boarded && (
                  <p>
                    You can read the rules now. Board Level 1 before
                    acknowledging them; Help Desk remains available for
                    questions.
                  </p>
                )}
                <fieldset
                  disabled={!boarded}
                  style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                >
                  <Rules data={data} act={act} />
                </fieldset>
              </>
            )}
            {panel === "rewards" && (
              <>
                <TrophyLeague trophies={data.user.trophies}/>
                <p>
                  Rankings are paused during Week 1. These are your own rewards
                  and released private results.
                </p>
                <DayOneRewards data={data} />
                <button className="btn" onClick={() => open("star-guide")}>
                  How to earn 3 stars
                </button>
                <MyResults data={data} />
                <Link className="btn" href="/gamer/week-one-challenges">
                  Challenges & rewards
                </Link>
              </>
            )}
            {panel === "star-guide" && (
              <LevelOneStarGuideContent
                record={data.dayOne?.records?.find(
                  (r) => r.userId === data.user._id,
                )}
                now={now}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
