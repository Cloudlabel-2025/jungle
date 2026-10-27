"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Flame,
  Trophy,
  Heart,
  Clock3,
  Check,
  CheckCheck,
  LockKeyhole,
  Code2,
  Terminal,
  Send,
  Target,
  Plus,
  Radio,
  ShieldCheck,
  Activity,
  BookOpen,
  AlertTriangle,
  Download,
  GitBranch,
  Flag,
  Users,
  Zap,
  Hexagon,
  CheckCircle2,
} from "lucide-react";
import { Panel, Badge, HP, Avatar, Modal, Empty, Form, Receipt } from "./ui";
import { EncounterGrid } from "./Expedition";
import JungleGame from "./JungleGame";
import ProjectBoard, { ProjectTaskDetails } from "./Projects";
import ExpeditionHeading from "./ExpeditionHeading";
import SupportConsole from "./SupportConsole";
import ChallengeManager, {
  ChallengeProgress,
  ChallengeTaskDetails,
} from "./Challenges";
import { teamRoles, playerRole } from "@/lib/team-roles.js";
import { ist, league } from "@/lib/rules.js";
const fmt = (date) =>
  new Date(date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const initials = (name) =>
  name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
const playerOptions = (data) =>
  data.roster.map((u) => ({
    value: u._id,
    label: `${u.name} · ${data.teams.find((t) => t._id === u.teamId)?.code}`,
  }));
const getName = (data, id) => data.roster.find((u) => u._id === id)?.name || id;
const Heading = ExpeditionHeading;
function Countdown({ date, now }) {
  const ms = new Date(date) - now;
  if (ms <= 0) return <span className="danger-text">Deadline passed</span>;
  const hours = Math.floor(ms / 3600000);
  return (
    <span>
      {Math.floor(hours / 24) > 0 ? `${Math.floor(hours / 24)}d ` : ""}
      {hours % 24}h {Math.floor(ms / 60000) % 60}m
    </span>
  );
}
function Stats({ items }) {
  return (
    <div className="stats-grid">
      {items.map(({ label, value, note, icon: Icon, tone = "" }, i) => (
        <div className={`stat ${tone}`} key={label}>
          <div className="stat-label">
            <span>{label}</span>
            <Icon size={17} />
          </div>
          <div className="stat-value">{value}</div>
          <div className="stat-note">{note}</div>
          <span className="stat-index">0{i + 1}</span>
        </div>
      ))}
    </div>
  );
}
function QuestCard({ task, data, onClick, now }) {
  const person = data.roster.find((u) => u._id === task.assigneeId);
  const dep = data.tasks.find((t) => t._id === task.dependencyId);
  return (
    <button className="quest-card" onClick={onClick}>
      <div className="quest-card-top">
        <span className="mono muted">
          {task.challengeId
            ? `CH-${task._id.slice(0, 8)}`
            : task._id.replace("quest_", "Q-").replace("_", "0")}
        </span>
        <Badge
          tone={
            task.priority === "CRITICAL"
              ? "red"
              : task.priority === "HIGH"
                ? "amber"
                : ""
          }
        >
          {task.priority}
        </Badge>
      </div>
      <h3>{task.title}</h3>
      {(task.challengeId || task.projectAttemptId) && (
        <p className="challenge-card-label">
          {task.challengeName ||
            data.projectLevels.find((l) => l._id === task.projectLevelId)
              ?.name}{" "}
          · {teamRoles.find((r) => r.code === task.targetRole)?.label}
          {task.assigneeId === data.user._id ? " · Assigned to you" : ""}
        </p>
      )}
      <p>{task.description}</p>
      {dep && dep.status !== "Done" && (
        <div className="dependency">
          <LockKeyhole size={12} />
          Dependency locked
        </div>
      )}
      <div className="quest-card-bottom">
        <span>
          <Avatar name={person?.name} small />
          {person?.name.split(" ")[0]}
        </span>
        <span className="quest-time">
          <Clock3 size={12} />
          <Countdown date={task.dueAt} now={now} />
        </span>
      </div>
      <div className="quest-report">
        <span className={task.reportedAt ? "lime-text" : ""}>
          {task.reportedAt ? <CheckCheck size={12} /> : <Radio size={12} />}{" "}
          {task.report || "Status report needed"}
        </span>
        <span>
          {task.projectAttemptId
            ? "Team stars + contribution rewards"
            : `+${task.xp * 3} XP · +${task.xp * 2} trophies`}
        </span>
      </div>
    </button>
  );
}
function QuestDetail({ task, data, close, act, staff = false }) {
  const fresh = data.tasks.find((t) => t._id === task._id) || task;
  if (fresh.projectAttemptId)
    return (
      <Modal
        title={fresh.title}
        kicker="TEAM PROJECT / ROLE CONTRIBUTION"
        close={close}
      >
        <ProjectTaskDetails task={fresh} data={data} act={act} staff={staff} />
      </Modal>
    );
  return (
    <Modal
      title={fresh.title}
      kicker={`${fresh._id} / QUEST BRIEF`}
      close={close}
    >
      <Badge tone="lime">{fresh.status}</Badge>
      <p className="detail-copy">{fresh.description}</p>
      <ChallengeTaskDetails task={fresh} data={data} act={act} staff={staff} />
      <div className="detail-grid">
        <span>
          EXPLORER<strong>{getName(data, fresh.assigneeId)}</strong>
        </span>
        <span>
          DEADLINE / IST<strong>{fmt(fresh.dueAt)}</strong>
        </span>
        <span>
          COMMUNICATION<strong>{fresh.report || "Awaiting report"}</strong>
        </span>
        <span>
          REWARD
          <strong>
            +{fresh.xp * 3} XP and +{fresh.xp * 2} trophies on approval
          </strong>
        </span>
      </div>
      {fresh.reportedAt && (
        <Receipt>Server report receipt: {fmt(fresh.reportedAt)} IST</Receipt>
      )}
      {staff ? (
        <>
          <div className="button-row">
            {fresh.status === "Review" && (
              <>
                <button
                  className="btn primary"
                  onClick={async () => {
                    if (
                      await act(
                        "commander/task",
                        { taskId: fresh._id, action: "approve" },
                        "Quest approved; XP and trophies recorded.",
                      )
                    )
                      close();
                  }}
                >
                  Approve quest <Check size={16} />
                </button>
                {!fresh.challengeId && (
                  <button
                    className="btn"
                    onClick={() =>
                      act("commander/task", {
                        taskId: fresh._id,
                        action: "return",
                      })
                    }
                  >
                    Return to progress
                  </button>
                )}
              </>
            )}
          </div>
          {fresh.status !== "Done" && (
            <Form
              fields={[
                {
                  name: "userId",
                  label: "Reassign within squad",
                  options: playerOptions({
                    ...data,
                    roster: data.roster.filter(
                      (u) =>
                        u.teamId === fresh.teamId &&
                        u.active !== false &&
                        (!fresh.challengeId ||
                          playerRole(u) === fresh.targetRole),
                    ),
                  }),
                },
                ...(fresh.challengeId
                  ? [
                      {
                        name: "reason",
                        label: "Reason for reassignment",
                        type: "textarea",
                        min: 10,
                      },
                    ]
                  : []),
              ]}
              submit="Reassign quest"
              onSubmit={(values) =>
                act("commander/task", {
                  ...values,
                  taskId: fresh._id,
                  action: "reassign",
                })
              }
            />
          )}
        </>
      ) : fresh.assigneeId === data.user._id && fresh.status !== "Done" ? (
        <>
          <div className="callout">
            <Radio size={18} />
            <p>
              <strong>Rule #10 · Keep your squad in the loop.</strong> Report
              before the deadline, even when the work is complete.
            </p>
          </div>
          <Form
            fields={[
              {
                name: "preDeadlineStatus",
                label: "Pre-deadline status",
                options: ["On Track", "At Risk", "Delayed", "Complete"].map(
                  (value) => ({ value, label: value }),
                ),
              },
            ]}
            submit="Transmit status"
            onSubmit={(v) =>
              act(
                "gamer/task-status",
                { ...v, taskId: fresh._id },
                "Status received with a server timestamp.",
              )
            }
          />
          {!fresh.challengeId && (
            <Form
              fields={[
                {
                  name: "status",
                  label: "Move quest",
                  options: ["Backlog", "In Progress", "Review"].map(
                    (value) => ({ value, label: value }),
                  ),
                },
              ]}
              initial={{ status: fresh.status }}
              submit="Update quest"
              onSubmit={(v) =>
                act("gamer/task-status", { ...v, taskId: fresh._id })
              }
            />
          )}
        </>
      ) : (
        <p className="muted">
          {fresh.status === "Done"
            ? "Quest sealed by Command."
            : "Only the assigned operative can update this quest."}
        </p>
      )}
    </Modal>
  );
}
function Board({ data, now, act, staff = false }) {
  const [selected, setSelected] = useState(null),
    [team, setTeam] = useState("all"),
    [challenge, setChallenge] = useState("all");
  const tasks = data.tasks.filter(
    (t) =>
      (team === "all" || t.teamId === team) &&
      (challenge === "all" || t.challengeId === challenge),
  );
  return (
    <>
      <ProjectBoard data={data} act={act} />
      <ChallengeProgress
        data={data}
        selected={challenge}
        onSelect={setChallenge}
      />
      {staff && (
        <div className="filter-row">
          <label>
            Squad filter{" "}
            <select value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="all">All five squads</option>
              {data.teams.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <span className="muted">
            {tasks.filter((t) => t.status === "Review").length} quests awaiting
            approval
          </span>
        </div>
      )}
      <div className="board">
        {["Backlog", "In Progress", "Review", "Done"].map((status, i) => (
          <section className="board-column" key={status}>
            <div className="column-heading">
              <span>
                <i className={`column-dot dot-${i}`} />
                {staff
                  ? status
                  : [
                      "Uncharted",
                      "On expedition",
                      "Awaiting clearance",
                      "Conquered",
                    ][i]}
              </span>
              <Badge>{tasks.filter((t) => t.status === status).length}</Badge>
            </div>
            {tasks
              .filter((t) => t.status === status)
              .map((task) => (
                <QuestCard
                  key={task._id}
                  task={task}
                  data={data}
                  now={now}
                  onClick={() => setSelected(task)}
                />
              ))}
            {!tasks.some((t) => t.status === status) && (
              <p className="column-empty">The trail is clear here.</p>
            )}
          </section>
        ))}
      </div>
      {selected && (
        <QuestDetail
          task={selected}
          data={data}
          close={() => setSelected(null)}
          act={act}
          staff={staff}
        />
      )}
    </>
  );
}
function SquadRoster({ data }) {
  const users = data.roster.filter((u) => u.teamId === data.user.teamId);
  return (
    <Panel
      title="Your expedition party"
      kicker="FIVE EXPLORERS. ONE WAY HOME."
      action={
        <Link href="/gamer/team-room" className="text-link">
          Comms
        </Link>
      }
    >
      <div className="roster">
        {users.map((u) => (
          <div className="roster-row" key={u._id}>
            <Avatar name={u.name} />
            <span>
              <strong>
                {u.name}
                {u._id === data.user._id && (
                  <small className="you-label">YOU</small>
                )}
              </strong>
              <small>{u.assignment}</small>
            </span>
            <span
              className={`presence-dot ${u.lastSeenAt && new Date(data.serverTime) - new Date(u.lastSeenAt) < 20000 ? "online" : ""}`}
              title={
                u.lastSeenAt &&
                new Date(data.serverTime) - new Date(u.lastSeenAt) < 20000
                  ? "Online in the arena"
                  : "Offline"
              }
              aria-label={
                u.lastSeenAt &&
                new Date(data.serverTime) - new Date(u.lastSeenAt) < 20000
                  ? "Online"
                  : "Offline"
              }
            />
            <HP value={u.hp} />
          </div>
        ))}
      </div>
      <div className="roster-footer">
        <span className="status-dot" />
        {users.filter((u) => u.hp > 0).length} operatives mission ready{" "}
        <span>{users.reduce((s, u) => s + u.trophies, 0)} trophies</span>
      </div>
    </Panel>
  );
}
function PunchIn({ data, now, act }) {
  const [reason, setReason] = useState("");
  const attendance = data.attendance.find((a) => a.day === ist(now).day);
  return (
    <Panel
      title="Daily camp check-in"
      kicker="SHOW UP. SET THE PACE."
      className="punch-panel"
      action={<Clock3 size={19} />}
    >
      <div className="punch-clock">
        {now.toLocaleTimeString("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
        })}
        <span>IST</span>
      </div>
      <p className="muted">
        {attendance
          ? `Uplink confirmed at ${fmt(attendance.clockAt)} IST.`
          : "Your squad is counting on you. Check in by 09:00 IST."}
      </p>
      {attendance ? (
        <div className="checked-in">
          <CheckCircle2 size={18} />
          {attendance.onTime
            ? "ON TIME · +3 XP / +2 TROPHIES"
            : "ATTENDANCE RECORDED"}
        </div>
      ) : (
        <>
          {ist(now).minutes > 555 && (
            <label className="late-reason">
              Running late? Tell Command why.
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="A short, specific explanation…"
                minLength={10}
              />
            </label>
          )}
          <button
            className="btn primary full"
            onClick={() =>
              act(
                "gamer/clock-in",
                { latenessReason: reason },
                "Attendance recorded. Welcome back to camp.",
              )
            }
          >
            <Target size={17} />
            Check in at camp
          </button>
          <small className="muted punch-footnote">
            {ist(now).minutes > 540
              ? "Late check-in records a −1 HP attendance infraction."
              : "On-time check-in earns +3 XP and +2 trophies."}
          </small>
        </>
      )}
    </Panel>
  );
}
export function GamerView(props) {
  return (
    <>
      <GamerCore {...props} />
      {props.screen !== "dashboard" && <SupportConsole {...props} />}
    </>
  );
}
function GamerCore({ screen, data, act, now }) {
  const [selected, setSelected] = useState(null);
  if (screen === "dashboard")
    return (
      <>
        <JungleGame
          data={data}
          act={act}
          camp={<PunchIn data={data} now={now} act={act} />}
          party={<SquadRoster data={data} />}
          onQuest={setSelected}
          support={
            <SupportConsole screen={screen} data={data} act={act} now={now} />
          }
        />
        {selected && (
          <QuestDetail
            task={selected}
            data={data}
            act={act}
            close={() => setSelected(null)}
          />
        )}
      </>
    );
  if (screen === "sprint-board")
    return (
      <>
        <Heading
          code="G03"
          title="Expedition objectives"
          subtitle="Own the work. Share the status. Move the mission forward."
          action={
            <Badge tone="lime">
              {data.tasks.filter((t) => t.status === "Done").length} /{" "}
              {data.tasks.length} SEALED
            </Badge>
          }
        />
        <div className="callout board-callout">
          <Radio size={18} />
          <p>
            <strong>Communication is part of delivery.</strong> Open a quest to
            transmit a pre-deadline status report. A Commander approves
            completed work.
          </p>
        </div>
        <Board data={data} now={now} act={act} />
      </>
    );
  if (screen === "before-you-board")
    return <Foundations data={data} act={act} />;
  if (screen === "team-room") return <Comms data={data} act={act} />;
  if (screen === "daily-journal")
    return <Journal data={data} act={act} now={now} />;
  if (screen === "rewards") return <Rewards data={data} />;
  return null;
}
function Foundations({ data, act }) {
  return (
    <>
      <Heading
        code="G02"
        title="Field Guide"
        subtitle="Optional lessons to help your team build its projects. These knowledge checks do not unlock map levels."
      />
      <EncounterGrid data={data} act={act} />
    </>
  );
}
function Comms({ data, act }) {
  const [message, setMessage] = useState(""),
    [blocker, setBlocker] = useState(false);
  const bottom = useRef();
  useEffect(() => {
    const stream = bottom.current?.parentElement;
    if (stream) stream.scrollTop = stream.scrollHeight;
  }, [data.messages.length]);
  return (
    <>
      <Heading
        code="G04"
        title="Campfire communications"
        subtitle="Good teams don’t go silent. Keep your channel open."
        action={
          <Badge tone="cyan">
            <Radio size={12} />
            SQUAD CHANNEL
          </Badge>
        }
      />
      <div className="comms-grid">
        <Panel
          title={data.teams.find((t) => t._id === data.user.teamId)?.name}
          kicker="PRIVATE SQUAD FREQUENCY"
          className="chat-panel"
        >
          <div className="chat-stream">
            {data.messages.length ? (
              data.messages.map((m) => (
                <div
                  className={`chat-message ${m.senderId === data.user._id ? "own" : ""} ${m.isBlocker ? "blocker-message" : ""}`}
                  key={m._id}
                >
                  <Avatar name={m.senderName} />
                  <div>
                    <div className="message-meta">
                      <strong>{m.senderName}</strong>
                      <small>{fmt(m.createdAt)} IST</small>
                      {m.isBlocker && (
                        <Badge tone={m.resolvedAt ? "lime" : "red"}>
                          {m.resolvedAt ? "RESOLVED" : "BLOCKER"}
                        </Badge>
                      )}
                    </div>
                    <p>{m.message}</p>
                  </div>
                </div>
              ))
            ) : (
              <Empty title="Open the channel">
                Share a win, ask a question, or raise a blocker with your squad.
              </Empty>
            )}
            <div ref={bottom} />
          </div>
          <form
            className="chat-compose"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await act(
                  "gamer/messages",
                  { message, isBlocker: blocker },
                  "Transmission delivered.",
                )
              ) {
                setMessage("");
                setBlocker(false);
              }
            }}
          >
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={blocker}
                onChange={(e) => setBlocker(e.target.checked)}
              />
              <Flag size={13} />
              Raise as a blocker
            </label>
            <div>
              <input
                aria-label="Message"
                placeholder="Transmit to your squad…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                required
              />
              <button className="btn primary" aria-label="Send message">
                <Send size={17} />
              </button>
            </div>
            <small className="muted">
              Your party’s radio updates automatically.
            </small>
          </form>
        </Panel>
        <div>
          <SquadRoster data={data} />
          <div className="callout">
            <ShieldCheck size={20} />
            <p>
              <strong>Make blockers actionable.</strong> Include the context,
              what you tried, and the help you need. Command can resolve
              blockers from the War Room.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
function Journal({ data, act, now }) {
  const today = data.journals.find((j) => j.day === ist(now).day);
  return (
    <>
      <Heading
        code="G05"
        title="Explorer’s journal"
        subtitle="Progress is a practice. Leave a record of yours."
        action={<Badge>{ist(now).day} / IST</Badge>}
      />
      <div className="two-columns">
        <Panel
          title={today ? "Today’s log is sealed" : "Today’s field notes"}
          kicker="DAILY REFLECTION / IMMUTABLE RECEIPT"
        >
          {today ? (
            <>
              <Receipt>
                Received {fmt(today.submittedAt)} IST · Receipt{" "}
                {today._id.slice(0, 8)}
              </Receipt>
              <p className="muted">
                Evidence {today._id}
                {today.supportTicketIds?.length
                  ? ` · Support ${today.supportTicketIds.join(", ")}`
                  : ""}
              </p>
              {[
                ["Completed work", today.workDone],
                ["Technical learnings", today.learnings],
                ["Blockers", today.blockers || "None reported"],
                ["Tomorrow’s commitments", today.tomorrowPlan],
              ].map(([label, value]) => (
                <div className="journal-entry" key={label}>
                  <span className="eyebrow">{label}</span>
                  <p>{value}</p>
                </div>
              ))}
            </>
          ) : (
            <Form
              fields={[
                {
                  name: "workDone",
                  label: "What did you ship today?",
                  type: "textarea",
                  min: 10,
                  placeholder:
                    "Deliverables, pull requests, and meaningful progress…",
                },
                {
                  name: "learnings",
                  label: "What did you learn?",
                  type: "textarea",
                  min: 10,
                  placeholder:
                    "Technical discoveries and lessons from the field…",
                },
                {
                  name: "blockers",
                  label: "What’s in your way?",
                  type: "textarea",
                  optional: true,
                  placeholder:
                    "Blockers or support you need. Leave empty if clear.",
                },
                {
                  name: "tomorrowPlan",
                  label: "What will you own tomorrow?",
                  type: "textarea",
                  min: 10,
                  placeholder: "Specific commitments for your next shift…",
                },
                {
                  name: "supportTicketId",
                  label: "Related private support ticket (optional)",
                  options: [
                    { value: "", label: "No linked ticket" },
                    ...(data.support?.tickets || []).map((t) => ({
                      value: t._id,
                      label: t.description.slice(0, 80),
                    })),
                  ],
                },
              ]}
              submit="Seal today’s field log"
              onSubmit={(v) =>
                act(
                  "gamer/journal",
                  v,
                  "Field log sealed. Your expedition record is saved.",
                )
              }
            />
          )}
        </Panel>
        <Panel title="Previous transmissions" kicker="YOUR FIELD HISTORY">
          {data.journals.filter((j) => j !== today).length ? (
            data.journals
              .filter((j) => j !== today)
              .map((j) => (
                <article className="history-entry" key={j._id}>
                  <span className="eyebrow">{j.day}</span>
                  <h3>{j.workDone}</h3>
                  <p>{j.learnings}</p>
                  <small className="muted">
                    {fmt(j.submittedAt)} IST · Evidence {j._id}
                    {j.supportTicketIds?.length
                      ? ` · Support ${j.supportTicketIds.join(", ")}`
                      : ""}
                  </small>
                </article>
              ))
          ) : (
            <Empty title="A fresh field journal">
              Your sealed daily logs will appear here.
            </Empty>
          )}
          <div className="callout">
            <Flame size={20} />
            <p>
              <strong>Consistency restores energy.</strong> Three consecutive
              days with on-time attendance, a journal, and no infractions
              restore +1 HP after the days close.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
function Rewards({ data }) {
  const ranked = data.leaderboard;
  return (
    <>
      <Heading
        code="G06"
        title="Relics & honours"
        subtitle="Trophies determine standings. XP measures your personal level. Perks recognise your contribution."
        action={
          <Badge tone="amber">
            <Trophy size={13} />
            {league(data.user.trophies)} LEAGUE
          </Badge>
        }
      />
      <div className="personal-experience">
        <Flame size={23} />
        <div>
          <h2>Your experience · Level {data.user.level}</h2>
          <p>
            {data.user.xp} XP · {100 - (data.user.xp % 100)} XP to your next
            level. Experience has no leaderboard.
          </p>
        </div>
        <strong>{data.user.trophies} trophies</strong>
      </div>
      <div className="two-columns">
        <Panel title="Trophy leaderboard" kicker="TROPHIES ONLY / LIVE">
          {data.rankingPaused && (
            <p>Week 1 discovery is descriptive. Student rankings are paused.</p>
          )}
          <div className="leaderboard">
            {ranked.map((u, i) => (
              <div
                key={u._id}
                className={`leaderboard-row ${u._id === data.user._id ? "is-you" : ""}`}
              >
                <span className="rank">{String(u.rank).padStart(2, "0")}</span>
                <Avatar name={u.name} />
                <span>
                  <strong>{u.name}</strong>
                  <small>
                    {data.teams.find((t) => t._id === u.teamId)?.name}
                  </small>
                </span>
                <Badge tone="amber">{league(u.trophies)}</Badge>
                <strong className="mono">
                  {u.trophies} <small>trophies</small>
                </strong>
              </div>
            ))}
          </div>
        </Panel>
        <div>
          <Panel
            title="Trophy ledger"
            kicker="APPEND-ONLY / DAILY CAP 50 TROPHIES"
          >
            {data.trophies.length ? (
              data.trophies.map((t) => (
                <div className="ledger-row" key={t._id}>
                  <span className="ledger-icon">
                    <Trophy size={17} />
                  </span>
                  <span>
                    <strong>{t.reason}</strong>
                    <small>{fmt(t.createdAt)} IST</small>
                  </span>
                  <b className="lime-text">+{t.amount}</b>
                </div>
              ))
            ) : (
              <Empty title="Your story starts at zero">
                Complete foundations, check in on time, and deliver approved
                quests to earn XP and trophies separately.
              </Empty>
            )}
          </Panel>
          <div className="league-guide">
            <Badge>BRONZE · 0–299</Badge>
            <Badge tone="cyan">SILVER · 300–699</Badge>
            <Badge tone="amber">GOLD · 700+</Badge>
          </div>
          <Panel
            title="Your unlocked perks"
            kicker="TWO COMMAND SEALS REQUIRED"
          >
            {data.proposals.filter(
              (p) => p.status === "APPROVED" && p.kind === "PERK",
            ).length ? (
              data.proposals
                .filter((p) => p.status === "APPROVED" && p.kind === "PERK")
                .map((p) => (
                  <div className="history-entry" key={p._id}>
                    <h3>{data.perks.find((k) => k._id === p.perkId)?.name}</h3>
                    <p>{p.rationale}</p>
                  </div>
                ))
            ) : (
              <Empty title="Recognition is on the horizon">
                Commanders nominate perks. Two Centre Command leads approve
                them. Trophies are never spent.
              </Empty>
            )}
          </Panel>
        </div>
      </div>
      <div className="section-title">
        <div>
          <span className="eyebrow">13 WAYS TO GO FURTHER</span>
          <h2>The perk vault</h2>
        </div>
        <span className="muted">Recognition. Growth. Opportunity.</span>
      </div>
      <div className="perk-grid">
        {data.perks.map((p, i) => (
          <article className="perk-card" key={p._id}>
            <AwardIcon i={i} />
            <Badge tone={p.tier === "LEGEND" ? "amber" : ""}>{p.tier}</Badge>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <span className="muted">
              <LockKeyhole size={12} />
              Commander nomination
            </span>
          </article>
        ))}
      </div>
    </>
  );
}
function AwardIcon({ i }) {
  return (
    <span className="perk-icon">
      {i % 3 === 0 ? (
        <Trophy size={23} />
      ) : i % 3 === 1 ? (
        <Zap size={23} />
      ) : (
        <ShieldCheck size={23} />
      )}
    </span>
  );
}
function Telemetry({ data, now, act, executive = false }) {
  const attendance = data.attendance.filter((a) => a.day === ist(now).day);
  const blockers = data.messages.filter((m) => m.isBlocker && !m.resolvedAt);
  const done = data.tasks.filter((t) => t.status === "Done").length;
  return (
    <>
      <Heading
        code={executive ? "CC02" : "MC01"}
        title={executive ? "Council overview" : "Guide’s lookout"}
        subtitle={
          executive
            ? "The whole arena. One clear view."
            : "Five squads. Twenty-five operatives. Keep the mission moving."
        }
        action={
          <Badge tone="lime">
            <span className="status-dot" />
            SERVER TELEMETRY
          </Badge>
        }
      />
      <Stats
        items={[
          {
            label: "ATTENDANCE",
            value: (
              <>
                {Math.round((attendance.length / 25) * 100)}
                <small>%</small>
              </>
            ),
            note: `${attendance.length} / 25 operatives checked in today`,
            icon: Users,
            tone: "lime",
          },
          {
            label: "ACTIVE BLOCKERS",
            value: (
              <>
                {blockers.length}
                <small>OPEN</small>
              </>
            ),
            note: "Help the squad move forward.",
            icon: Flag,
            tone: blockers.length ? "amber" : "",
          },
          {
            label: "SPRINT VELOCITY",
            value: (
              <>
                {done}
                <small>/ {data.tasks.length}</small>
              </>
            ),
            note: "Quests approved by Command",
            icon: Activity,
            tone: "cyan",
          },
          {
            label: "ENERGY STABILITY",
            value: (
              <>
                {Math.round(
                  (data.roster.reduce((s, u) => s + u.hp, 0) / 125) * 100,
                )}
                <small>%</small>
              </>
            ),
            note: `${data.rescues.filter((r) => r.status !== "CLOSED").length} open rescue cases`,
            icon: Heart,
            tone: "amber",
          },
        ]}
      />
      <Panel title="Squad radar" kicker="DELIVERY / ENERGY / COMMUNICATION">
        <div className="squad-telemetry">
          {data.teams.map((t) => {
            const users = data.roster.filter((u) => u.teamId === t._id),
              tasks = data.tasks.filter((q) => q.teamId === t._id),
              done = tasks.filter((q) => q.status === "Done").length;
            return (
              <div className="telemetry-squad" key={t._id}>
                <div
                  className="squad-emblem"
                  style={{ "--squad-color": t.color }}
                >
                  <Hexagon size={60} strokeWidth={1} />
                  <span>{t.code}</span>
                </div>
                <h3>{t.name}</h3>
                <span className="muted">{users.length} EXPLORERS</span>
                <div className="telemetry-numbers">
                  <span>
                    <b>{users.reduce((s, u) => s + u.hp, 0)}</b> /{" "}
                    {users.length * 5} HP
                  </span>
                  <span>
                    <b>{users.reduce((s, u) => s + u.trophies, 0)}</b> trophies
                  </span>
                </div>
                <div className="progress-track">
                  <i
                    style={{
                      width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`,
                      background: t.color,
                    }}
                  />
                </div>
                <small className="muted">
                  {done} / {tasks.length} quests sealed
                </small>
              </div>
            );
          })}
        </div>
      </Panel>
      <div className="two-columns lower-panels">
        <Panel title="Blocker frequency" kicker="INTERVENTIONS NEEDED">
          {blockers.length ? (
            blockers.map((m) => (
              <div className="history-entry" key={m._id}>
                <Badge tone="red">BLOCKER</Badge>
                <h3>{m.senderName}</h3>
                <p>{m.message}</p>
                <button
                  className="btn small"
                  onClick={() =>
                    act(
                      "commander/blocker",
                      { messageId: m._id },
                      "Blocker cleared.",
                    )
                  }
                >
                  Mark resolved
                  <Check size={14} />
                </button>
              </div>
            ))
          ) : (
            <Empty title="No active blockers">
              Squad blocker broadcasts appear here for rapid support.
            </Empty>
          )}
        </Panel>
        <Panel title="Slippage watch" kicker="DEADLINES / EARLY WARNINGS">
          {data.tasks.filter(
            (t) =>
              t.status !== "Done" &&
              (new Date(t.dueAt) < now ||
                ["At Risk", "Delayed"].includes(t.report)),
          ).length ? (
            data.tasks
              .filter(
                (t) =>
                  t.status !== "Done" &&
                  (new Date(t.dueAt) < now ||
                    ["At Risk", "Delayed"].includes(t.report)),
              )
              .map((t) => (
                <div className="history-entry" key={t._id}>
                  <h3>{t.title}</h3>
                  <p>
                    {getName(data, t.assigneeId)} ·{" "}
                    {t.report || "No pre-deadline status"}
                  </p>
                  <small className="danger-text">{fmt(t.dueAt)} IST</small>
                </div>
              ))
          ) : (
            <Empty title="No slippage signals">
              At-risk reports and overdue quests are monitored by the server.
            </Empty>
          )}
        </Panel>
      </div>
    </>
  );
}
export function StaffView(props) {
  return (
    <>
      <StaffCore {...props} />
      <SupportConsole {...props} />
    </>
  );
}
function StaffCore({ screen, data, act, now }) {
  const isCentre = data.user.role === "CENTRE_COMMAND";
  if (screen === "dashboard")
    return <Telemetry data={data} now={now} act={act} executive={isCentre} />;
  if (screen === "sprints")
    return (
      <>
        <Heading
          code="MC02"
          title="Trail objectives"
          subtitle="Remove friction. Review the work. Make the next move clear."
        />
        <Board data={data} now={now} act={act} staff />
      </>
    );
  if (screen === "coaching") return <Coaching data={data} act={act} />;
  if (screen === "awards") return <Proposals data={data} act={act} />;
  if (screen === "setup")
    return (
      <>
        <Setup data={data} act={act} />
        <ChallengeManager data={data} act={act} />
      </>
    );
  if (screen === "rules-approvals") return <Approvals data={data} act={act} />;
  if (screen === "client-control") return <Chaos data={data} act={act} />;
  if (screen === "reports") return <Reports data={data} act={act} />;
  return null;
}
function Coaching({ data, act }) {
  const [tab, setTab] = useState("coaching");
  return (
    <>
      <Heading
        code="MC03"
        title="Rescue camp"
        subtitle="Accountability with a way forward. No operative gets left behind."
      />
      <div className="tabs">
        {["coaching", "infractions", "rescue cases"].map((t) => (
          <button
            onClick={() => setTab(t)}
            className={tab === t ? "active" : ""}
            key={t}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "coaching" ? (
        <div className="two-columns">
          <Panel title="A focused check-in" kicker="PRIVATE COMMANDER NOTES">
            <Form
              fields={[
                {
                  name: "userId",
                  label: "Operative",
                  options: playerOptions(data),
                },
                {
                  name: "standupRating",
                  label:
                    "90-second standup score · 1 needs support, 5 excellent",
                  type: "number",
                  min: 1,
                  max: 5,
                },
                {
                  name: "notes",
                  label: "Observation & next action",
                  type: "textarea",
                  min: 10,
                },
              ]}
              submit="Record coaching"
              onSubmit={(v) =>
                act("commander/coaching", v, "Private coaching note recorded.")
              }
            />
          </Panel>
          <Panel title="Coaching history" kicker="VISIBLE TO COMMAND ONLY">
            {data.coaching.length ? (
              data.coaching.map((c) => (
                <article className="history-entry" key={c._id}>
                  <Badge tone="cyan">STANDUP {c.standupRating} / 5</Badge>
                  <h3>{getName(data, c.userId)}</h3>
                  <p>{c.notes}</p>
                  <small className="muted">{fmt(c.createdAt)} IST</small>
                </article>
              ))
            ) : (
              <Empty title="Space for a better next shift">
                Record observations and a clear next action for each operative.
              </Empty>
            )}
          </Panel>
        </div>
      ) : tab === "infractions" ? (
        <div className="two-columns">
          <Panel
            title="Log a rule infraction"
            kicker="EXACTLY −1 HP / APPEND-ONLY AUDIT"
          >
            <Form
              fields={[
                {
                  name: "userId",
                  label: "Operative",
                  options: playerOptions(data),
                },
                {
                  name: "ruleId",
                  label: "D18 rule",
                  options: data.rules.map((r) => ({
                    value: String(r._id),
                    label: `#${r._id} · ${r.text}`,
                  })),
                },
                {
                  name: "notes",
                  label: "Evidence & context",
                  type: "textarea",
                  min: 10,
                },
              ]}
              submit="Record −1 HP infraction"
              onSubmit={(v) =>
                act(
                  "commander/rules",
                  {
                    ...v,
                    ruleId: Number(v.ruleId),
                    eventKey: crypto.randomUUID(),
                    deduction: 1,
                  },
                  "Infraction recorded. Rescue and warning thresholds evaluated.",
                )
              }
            />
          </Panel>
          <Panel title="Energy audit" kicker="SERVER-VERIFIED">
            {data.energy.length ? (
              data.energy.map((e) => (
                <div className="ledger-row" key={e._id}>
                  <Heart size={18} />
                  <span>
                    <strong>{getName(data, e.userId)}</strong>
                    <small>
                      {e.reason} · {fmt(e.createdAt)}
                    </small>
                  </span>
                  <b className={e.change > 0 ? "lime-text" : "danger-text"}>
                    {e.change > 0 ? "+" : ""}
                    {e.change} HP
                  </b>
                </div>
              ))
            ) : (
              <Empty title="Clean energy ledger">
                Infractions and clean-day recoveries will appear here.
              </Empty>
            )}
          </Panel>
        </div>
      ) : (
        <div className="two-columns">
          {data.rescues.length ? (
            data.rescues.map((r) => (
              <Panel
                key={r._id}
                title={getName(data, r.userId)}
                kicker={`RESCUE ${r._id.slice(0, 8)}`}
                action={
                  <Badge tone={r.status === "CLOSED" ? "lime" : "red"}>
                    {r.status}
                  </Badge>
                }
              >
                <p className="muted">
                  Opened {fmt(r.openedAt)} IST. The squad stays in the game.
                </p>
                {r.plan && (
                  <div className="callout">
                    <ShieldCheck size={20} />
                    <p>{r.plan}</p>
                  </div>
                )}
                {r.status !== "CLOSED" && (
                  <Form
                    fields={[
                      {
                        name: "plan",
                        label: "Mandatory remediation plan",
                        type: "textarea",
                        min: 20,
                      },
                    ]}
                    initial={{ plan: r.plan || "" }}
                    submit="Save recovery plan"
                    onSubmit={(v) =>
                      act(
                        "commander/rescue",
                        { ...v, rescueId: r._id },
                        "Recovery plan saved. Clean-day recovery remains server-controlled.",
                      )
                    }
                  />
                )}
              </Panel>
            ))
          ) : (
            <Panel title="All operatives standing">
              <Empty title="No rescue cases">
                Reaching zero HP opens a case automatically. A plan and three
                qualifying clean days support recovery.
              </Empty>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
function ProposalList({ data, act, review = false }) {
  return data.proposals.length ? (
    data.proposals.map((p) => (
      <article className="proposal-card" key={p._id}>
        <div>
          <Badge
            tone={
              p.status === "APPROVED" && p.kind === "PERK"
                ? "lime"
                : p.status === "REJECTED"
                  ? "red"
                  : "amber"
            }
          >
            {p.status.replaceAll("_", " ")}
          </Badge>
          <span className="muted mono">{p.approvers.length} / 2 SEALS</span>
        </div>
        <h3>
          {p.kind === "HP_OVERRIDE"
            ? `Emergency restoration · +${p.amount} HP`
            : p.kind === "XP_OVERRIDE"
              ? `Emergency award · +${p.amount} XP`
              : data.perks.find((k) => k._id === p.perkId)?.name}
        </h3>
        <p>
          <strong>{getName(data, p.recipientId)}</strong> · {p.rationale}
        </p>
        <small className="muted">Filed {fmt(p.createdAt)} IST</small>
        {review && p.status === "PENDING_APPROVAL" && (
          <div className="button-row">
            <button
              disabled={
                p.approvers.includes(data.user._id) ||
                p.proposerId === data.user._id
              }
              className="btn primary small"
              onClick={() =>
                act(
                  "centre-command/approvals",
                  { proposalId: p._id, action: "APPROVE" },
                  "Approval seal recorded. Two distinct leads are required.",
                )
              }
            >
              <ShieldCheck size={14} />
              {p.approvers.includes(data.user._id)
                ? "Your seal is recorded"
                : "Add approval seal"}
            </button>
            <button
              className="btn small danger-text"
              disabled={
                p.approvers.includes(data.user._id) ||
                p.proposerId === data.user._id
              }
              onClick={() =>
                act(
                  "centre-command/approvals",
                  { proposalId: p._id, action: "REJECT" },
                  "Proposal rejected.",
                )
              }
            >
              Reject
            </button>
          </div>
        )}
      </article>
    ))
  ) : (
    <Empty title="No proposals in the queue">
      Commander nominations appear here with their justification.
    </Empty>
  );
}
function Proposals({ data, act }) {
  return (
    <>
      <Heading
        code="MC04"
        title="Recognize the climb"
        subtitle="Nominate effort that deserves more opportunity."
      />
      <div className="two-columns">
        <Panel title="Propose a perk" kicker="NOMINATE / JUSTIFY / SUBMIT">
          <Form
            fields={[
              {
                name: "recipientId",
                label: "Recipient",
                options: playerOptions(data),
              },
              {
                name: "perkId",
                label: "Perk",
                options: data.perks.map((p) => ({
                  value: p._id,
                  label: `${p.name} · ${p.tier}`,
                })),
              },
              {
                name: "rationale",
                label: "Why this operative? Cite their contribution.",
                type: "textarea",
                min: 15,
              },
            ]}
            submit="Send to Centre Command"
            onSubmit={(v) =>
              act(
                "commander/proposals",
                v,
                "Nomination sent for two-lead approval.",
              )
            }
          />
          <p className="muted fine-print">
            Perks require two distinct Centre Command leads. XP and trophies
            cannot be spent.
          </p>
        </Panel>
        <Panel title="Proposal queue" kicker="FOLLOW THE SEALS">
          <ProposalList data={data} />
        </Panel>
      </div>
    </>
  );
}
function Setup({ data, act }) {
  return (
    <>
      <ProjectBoard data={data} act={act} />
      <Heading
        code="CC01"
        title="Expedition setup"
        subtitle="Set the conditions for meaningful work."
        action={
          <div className="button-row">
            <a className="btn primary" href="#role-challenges">
              Manage challenges
            </a>
            <Badge>CONFIG REV {data.cohort.version}</Badge>
          </div>
        }
      />
      <div className="two-columns">
        <Panel
          title="Simulation topology"
          kicker="TITAN / ALPHA / ASIA-KOLKATA"
        >
          <Form
            key={data.cohort.version}
            fields={[
              { name: "college", label: "Institute" },
              { name: "name", label: "Cohort name" },
              {
                name: "currentWeek",
                label: "Current simulation week",
                type: "number",
                min: 1,
                max: 52,
              },
              {
                name: "scenario",
                label: "Client scenario brief",
                type: "textarea",
                min: 10,
              },
            ]}
            initial={data.cohort}
            submit="Save arena configuration"
            onSubmit={(v) =>
              act(
                "centre-command/setup",
                { ...v, version: data.cohort.version },
                "Arena configuration updated.",
              )
            }
          />
          <div className="detail-grid">
            <span>
              SUPPORT WORKDAY
              <strong>
                {data.support?.calendar
                  ? `${String(Math.floor(data.support.calendar.startMinute / 60)).padStart(2, "0")}:${String(data.support.calendar.startMinute % 60).padStart(2, "0")}–${String(Math.floor((data.support.calendar.startMinute + 480) / 60)).padStart(2, "0")}:${String(data.support.calendar.startMinute % 60).padStart(2, "0")} ${data.support.calendar.timeZone}`
                  : "Configure working calendar below"}
              </strong>
            </span>
            <span>
              START DATE<strong>{data.cohort.startDate}</strong>
            </span>
            <span>
              DATABASE<strong>MongoDB / replica set</strong>
            </span>
            <span>
              TIME AUTHORITY<strong>Server · Asia/Kolkata</strong>
            </span>
          </div>
        </Panel>
        <Panel title="Squad allocations" kicker="FIVE SQUADS / 25 EXPLORERS">
          <Form
            fields={[
              {
                name: "userId",
                label: "Operative",
                options: playerOptions(data),
              },
              {
                name: "teamId",
                label: "Assign to squad",
                options: data.teams.map((t) => ({
                  value: t._id,
                  label: t.name,
                })),
              },
              {
                name: "teamRoleCode",
                label: "Team role",
                options: [
                  { value: "", label: "Keep current role" },
                  ...teamRoles.map((r) => ({ value: r.code, label: r.label })),
                ],
              },
            ]}
            submit="Update allocation"
            onSubmit={(v) =>
              act(
                "centre-command/roster",
                v,
                "Operative and active quest allocation updated.",
              )
            }
          />
          {data.teams.map((t) => (
            <div className="allocation-row" key={t._id}>
              <span className="squad-mark" style={{ color: t.color }}>
                {t.code}
              </span>
              <span>
                <strong>{t.name}</strong>
                <small>
                  {data.roster
                    .filter((u) => u.teamId === t._id)
                    .map((u) => u.name.split(" ")[0])
                    .join(" · ")}
                </small>
              </span>
              <Badge>
                {data.roster.filter((u) => u.teamId === t._id).length}
              </Badge>
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}
function Approvals({ data, act }) {
  const [tab, setTab] = useState("approvals");
  return (
    <>
      <Heading
        code="CC03"
        title="Expedition code & seals"
        subtitle="Protect the integrity of the game. Every decision leaves a trace."
        action={<Badge tone="cyan">RULESET v{data.cohort.rulesVersion}</Badge>}
      />
      <div className="tabs">
        {["approvals", "D18 rules", "version history"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "active" : ""}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "approvals" ? (
        <div className="two-columns">
          <Panel title="The two-person rule" kicker="INDEPENDENT SIGNOFF">
            <ProposalList data={data} act={act} review />
          </Panel>
          <Panel
            title="The approval protocol"
            kicker="TWO MINDS. ONE STANDARD."
          >
            <div className="protocol-step">
              <span>01</span>
              <div>
                <h3>A Commander nominates</h3>
                <p>
                  Every perk starts with a named recipient and an evidence-based
                  justification.
                </p>
              </div>
            </div>
            <div className="protocol-step">
              <span>02</span>
              <div>
                <h3>Two leads review independently</h3>
                <p>
                  A lead cannot add a second seal or approve their own proposal.
                </p>
              </div>
            </div>
            <div className="protocol-step">
              <span>03</span>
              <div>
                <h3>Recognition is sealed</h3>
                <p>
                  Only two distinct approvals unlock the perk. Trophy balances
                  stay untouched.
                </p>
              </div>
            </div>
            <EmergencyOverride data={data} act={act} />
          </Panel>
        </div>
      ) : tab === "D18 rules" ? (
        <Panel title="The field manual" kicker="19 RULES / ONE SHARED STANDARD">
          {data.rules.map((r) => (
            <div className="rule-row" key={r._id}>
              <span className="mono">{String(r._id).padStart(2, "0")}</span>
              <strong>{r.text}</strong>
              <Badge>{r.track}</Badge>
              <span className="danger-text">−1 HP</span>
            </div>
          ))}
        </Panel>
      ) : (
        <div className="two-columns">
          <Panel
            title="Publish a rules amendment"
            kicker="VERSIONED / AUDITABLE"
          >
            <Form
              fields={[
                {
                  name: "text",
                  label: "Amendment and effective guidance",
                  type: "textarea",
                  min: 20,
                },
              ]}
              submit="Publish next rules version"
              onSubmit={(v) =>
                act(
                  "centre-command/rules",
                  v,
                  "Rules amendment version recorded.",
                )
              }
            />
            <p className="muted fine-print">
              Amendments supplement the field manual. Core XP, HP, and deadline
              invariants remain enforced by the server engine.
            </p>
          </Panel>
          <Panel title="Rules version history" kicker="APPEND-ONLY">
            {data.versions.map((v) => (
              <div className="history-entry" key={v._id}>
                <Badge tone="cyan">VERSION {v.version}</Badge>
                <p>{v.text}</p>
                <small className="muted">{fmt(v.createdAt)} IST</small>
              </div>
            ))}
            <div className="history-entry">
              <Badge>VERSION 1</Badge>
              <p>
                Original D18 field manual and server-authoritative game
                mechanics.
              </p>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
function EmergencyOverride({ data, act }) {
  return (
    <>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">EXCEPTIONAL / TWO INDEPENDENT SEALS</span>
          <h2>Emergency override</h2>
        </div>
      </div>
      <Form
        fields={[
          {
            name: "recipientId",
            label: "Operative",
            options: playerOptions(data),
          },
          {
            name: "kind",
            label: "Restoration type",
            options: [
              { value: "HP_OVERRIDE", label: "Restore HP · capped at 5 HP" },
              {
                value: "XP_OVERRIDE",
                label: "Award XP · daily 150 XP cap applies; no trophies",
              },
            ],
          },
          {
            name: "amount",
            label: "Amount · HP 1–5 / XP 1–150",
            type: "number",
            min: 1,
            max: 150,
          },
          {
            name: "rationale",
            label: "Emergency evidence and justification",
            type: "textarea",
            min: 20,
          },
        ]}
        submit="Propose emergency override"
        onSubmit={(v) =>
          act(
            "centre-command/override",
            v,
            "Override proposed. The other two Centre Command leads must approve.",
          )
        }
      />
    </>
  );
}
function Chaos({ data, act }) {
  const unlocked = data.cohort.currentWeek >= 3;
  return (
    <>
      <Heading
        code="CC04"
        title="Into the unexpected"
        subtitle="Real clients change the brief. Great squads adapt."
        action={
          <Badge tone={unlocked ? "red" : ""}>
            {unlocked ? "DISRUPTIONS ARMED" : "UNLOCKS WEEK 03"}
          </Badge>
        }
      />
      <div className="two-columns">
        <Panel
          title="Inject a client change"
          kicker="ONE PAYLOAD / ALL FIVE SQUADS"
        >
          {unlocked ? (
            <Form
              fields={[
                { name: "title", label: "Client change headline", min: 5 },
                {
                  name: "disruptionType",
                  label: "Disruption class",
                  options: [
                    "Scope change",
                    "Compliance update",
                    "Performance requirement",
                    "Client escalation",
                  ].map((value) => ({ value, label: value })),
                },
                {
                  name: "description",
                  label: "New requirements and acceptance criteria",
                  type: "textarea",
                  min: 20,
                },
              ]}
              submit="Broadcast to the entire arena"
              onSubmit={(v) =>
                act(
                  "centre-command/client-control",
                  v,
                  "Client change broadcast with one shared server timestamp.",
                )
              }
            />
          ) : (
            <Empty title="Let the foundations settle">
              <LockKeyhole size={28} />
              <p>
                The disruption channel unlocks in week 3. Set the simulation
                week from Arena Setup when the cohort is ready.
              </p>
              <Link href="/centre-command/setup" className="btn">
                Open arena setup
              </Link>
            </Empty>
          )}
          <div className="callout">
            <Zap size={22} />
            <p>
              <strong>Simultaneous by design.</strong> Every squad receives the
              same stored payload and broadcast timestamp. Connected clients
              sync on the next 6-second poll.
            </p>
          </div>
        </Panel>
        <Panel title="Disruption history" kicker="CLIENT TRANSMISSION LOG">
          {data.events.length ? (
            data.events.map((e) => (
              <article className="history-entry" key={e._id}>
                <Badge tone="red">{e.disruptionType}</Badge>
                <h3>{e.title}</h3>
                <p>{e.description}</p>
                <small className="muted">
                  {fmt(e.broadcastAt)} IST · ALL SQUADS
                </small>
              </article>
            ))
          ) : (
            <Empty title="A quiet client channel">
              Client changes will be recorded here with a shared server
              timestamp.
            </Empty>
          )}
        </Panel>
      </div>
    </>
  );
}
function Reports({ data, act }) {
  return (
    <>
      <Heading
        code="CC05"
        title="Expedition records"
        subtitle="See the growth behind the score. Close the mission with evidence."
        action={
          <a
            className="btn primary"
            href="/api/centre-command/reports?format=csv"
          >
            <Download size={16} />
            Export audit CSV
          </a>
        }
      />
      <Panel
        title="Competency & clearance"
        kicker="FOUNDATIONS / DELIVERY / ENERGY"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>EXPLORER</th>
                <th>SQUAD</th>
                <th>TEAM PROJECTS</th>
                <th>QUESTS</th>
                <th>HP</th>
                <th>XP / LEVEL</th>
                <th>TROPHIES</th>
                <th>CLEARANCE</th>
              </tr>
            </thead>
            <tbody>
              {data.roster.map((u) => {
                const tasks = data.tasks.filter((t) => t.assigneeId === u._id),
                  done = tasks.filter((t) => t.status === "Done").length,
                  progress = data.projectAttempts.filter(
                    (p) => p.teamId === u.teamId && p.status === "CLEARED",
                  ).length,
                  clearance = data.clearances.find((c) => c.userId === u._id);
                return (
                  <tr key={u._id}>
                    <td>
                      <span className="table-person">
                        <Avatar name={u.name} small />
                        {u.name}
                      </span>
                    </td>
                    <td>{data.teams.find((t) => t._id === u.teamId)?.code}</td>
                    <td>{progress}/10</td>
                    <td>
                      {done}/{tasks.length}
                    </td>
                    <td>
                      <HP value={u.hp} />
                    </td>
                    <td className="mono">
                      {u.xp} / L{u.level}
                    </td>
                    <td className="mono">{u.trophies}</td>
                    <td>
                      {clearance ? (
                        <Badge tone="lime">
                          CLEARED · {clearance.competency}/5
                        </Badge>
                      ) : (
                        <Badge>IN PROGRESS</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="two-columns lower-panels">
        <Panel
          title="Certificate clearance"
          kicker="EVIDENCE BEFORE ENDORSEMENT"
        >
          <Form
            fields={[
              {
                name: "userId",
                label: "Candidate",
                options: playerOptions(data),
              },
              {
                name: "competency",
                label: "Assessed competency · 1–5",
                type: "number",
                min: 1,
                max: 5,
              },
            ]}
            submit="Verify & clear candidate"
            onSubmit={(v) =>
              act(
                "centre-command/clearance",
                v,
                "Candidate cleared with recorded competency score.",
              )
            }
          />
          <p className="muted fine-print">
            Server checks all 10 team projects, approved assigned objectives,
            positive HP, and no open rescue case.
          </p>
        </Panel>
        <Panel title="Mission evidence" kicker="MEASURE WHAT MATTERS">
          <div className="report-metric">
            <span>Sealed daily journals</span>
            <strong>{data.journals.length}</strong>
          </div>
          <div className="report-metric">
            <span>Recorded coaching sessions</span>
            <strong>{data.coaching.length}</strong>
          </div>
          <div className="report-metric">
            <span>Recorded energy changes</span>
            <strong>{data.energy.length}</strong>
          </div>
          <div className="report-metric">
            <span>Approved perk nominations</span>
            <strong>
              {
                data.proposals.filter(
                  (p) => p.status === "APPROVED" && p.kind === "PERK",
                ).length
              }
            </strong>
          </div>
          <div className="report-metric">
            <span>Certificate clearances</span>
            <strong>{data.clearances.length}</strong>
          </div>
        </Panel>
      </div>
    </>
  );
}
