import { supportConsoleFixture } from "./support-console-fixture.mjs";

export function staffDashboardFixture(role = "MISSION_COMMANDER") {
  const data = supportConsoleFixture();
  data.user = { _id: role === "MISSION_COMMANDER" ? "guide-1" : "cc-preview", name: role === "MISSION_COMMANDER" ? "Campus guide" : "Campus coordinator", role };
  data.teams = Array.from({ length: 8 }, (_, i) => ({ _id: `team-${i}`, name: `Squad ${i + 1}`, code: `S${i + 1}`, color: "#a2b58c" }));
  data.roster = data.teams.map((t, i) => ({ _id: `learner-${i + 1}`, name: `Learner ${i + 1}`, teamId: t._id, hp: 4, trophies: 8 }));
  data.tasks = Array.from({ length: 7 }, (_, i) => ({ _id: `task-${i}`, teamId: data.teams[i]._id, title: `Pending task ${i + 1}`, assigneeId: data.roster[i]._id, status: "In Progress", dueAt: "2026-11-26T09:00:00Z", report: "At Risk" }));
  data.messages = Array.from({ length: 6 }, (_, i) => ({ _id: `message-${i}`, isBlocker: true, senderName: data.roster[i].name, message: `Help with checkpoint ${i + 1}` }));
  data.attendance = []; data.rescues = [];
  data.weekOneProgram = { levelTargets: { members: data.roster }, attempts: [], tickets: [], days: [] };
  if (role === "MISSION_COMMANDER") {
    data.support.tickets = data.support.tickets.filter(t => t.assignedTo === data.user._id);
    data.support.cases = data.support.cases.filter(c => c.status === "PUBLISHED");
  }
  return data;
}
