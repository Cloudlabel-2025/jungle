import { validateAvatar } from './avatar.js';
import { stickerImage } from './avatar-stickers.js';
import { assignmentSlots, assignmentSlotKey } from './team-slots.js';
// Compatibility for historical feature definitions. New accounts use teamRoleCode.
export const characters = assignmentSlots;
export const characterKey = assignmentSlotKey;
export function characterFor(player) {
  if (!player || player.characterHidden || !player.avatar) return null;
  let avatar;
  try {
    avatar = validateAvatar(player.avatar.toObject ? player.avatar.toObject() : player.avatar);
  } catch {
    return null;
  }
  return {
    key: player._id || 'personal-avatar',
    label: 'Full-stack explorer',
    variant: avatar.style,
    name: player.name || 'Explorer',
    avatar,
    color: avatar.topColor,
    image: stickerImage(avatar, { portrait: true }),
    bodyImage: stickerImage(avatar),
    signature: JSON.stringify(avatar),
  };
}
export function fullStackTeamReady(players, teamId) {
  const active = players.filter(player => player.teamId === teamId && player.active !== false && player.role === 'GAMER');
  return active.length === 5 && assignmentSlots.every(slot => active.filter(player => assignmentSlotKey(player) === slot.key).length === 1);
}
export const disciplines = [
  { code: "FRONTEND", label: "Frontend" },
  { code: "BACKEND", label: "Backend" },
  { code: "DATABASE", label: "Database" },
  { code: "TESTING", label: "Testing" },
  { code: "DEPLOYMENT", label: "Deployment & integration" },
];
export function projectTaskLabel(task) {
  return task?.discipline
    ? `${task.featureName} · ${disciplines.find((d) => d.code === task.discipline)?.label || task.discipline}`
    : null;
}
