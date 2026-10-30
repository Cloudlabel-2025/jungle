export function ist(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    seconds: Number(parts.second),
  };
}
export const league = (xp) =>
  xp >= 700 ? "GOLD" : xp >= 300 ? "SILVER" : "BRONZE";
export const allowedReports = ["Complete", "On Track", "At Risk", "Delayed"];
export const allowedStates = ["Backlog", "In Progress", "Review", "Done"];
export function attendanceRule(now, reason = "") {
  const { day, minutes, seconds } = ist(now);
  const elapsed = minutes * 60 + seconds + now.getMilliseconds() / 1000;
  if (elapsed > 555 * 60 && reason.trim().length < 10)
    throw new Error(
      "After 09:15 IST, provide a lateness reason of at least 10 characters.",
    );
  return { day, onTime: elapsed <= 540 * 60 };
}
export function deadlineInfraction(task) {
  return !task.reportedAt || new Date(task.reportedAt) >= new Date(task.dueAt);
}
export function boundedAward(requested, today, cap = 50) {
  return Math.max(0, Math.min(requested, cap - today));
}
export function playerEnergy(player) {
  return player.hp <= 0 ? 0 : Math.min(3, Math.max(1, player.energy ?? 3));
}
export function healthDrop(hp, drops, energy = 3) {
  const current = playerEnergy({ hp, energy });
  const lostLife = hp > 0 && current === 1;
  const next = Math.max(0, hp - (lostLife ? 1 : 0));
  return {
    hp: next,
    energy: next === 0 ? 0 : lostLife ? 3 : current - 1,
    lifeChange: lostLife ? -1 : 0,
    drops: drops + 1,
    warning: drops + 1 >= 3,
    rescue: next === 0,
  };
}
