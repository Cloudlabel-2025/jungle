// Server timestamps synchronise the clock but do not require replacing all
// workspace data. Include the derived presence boundary used by SquadRoster.
export function workspaceStateSignature(data) {
  const now = Date.parse(data.serverTime);
  const presence = (data.roster || []).map(user => Boolean(user.lastSeenAt && now - Date.parse(user.lastSeenAt) < 20000));
  return JSON.stringify(data, (key, value) => key === "serverTime" ? undefined : value) + JSON.stringify(presence);
}
