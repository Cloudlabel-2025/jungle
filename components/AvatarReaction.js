"use client";
import { useContext } from "react";
import { WorkspaceContext } from "./WorkspaceContext";
import AvatarPortrait from "./AvatarPortrait";
import { avatarFor } from "@/lib/avatar";
export default function AvatarReaction({
  player,
  mood = "celebrate",
  caption,
  detail,
  compact = false,
}) {
  const workspace = useContext(WorkspaceContext),
    actor = player || workspace?.data?.user;
  if (
    !actor ||
    actor.role !== "GAMER" ||
    actor.characterHidden ||
    !actor.avatar
  )
    return null;
  const title =
    caption ||
    (mood === "celebrate"
      ? "You did it, explorer!"
      : mood === "sad"
        ? "Take a breath. Try again."
        : "You've got this.");
  return (
    <section
      className={`avatar-reaction reaction-${mood}${compact ? " is-compact" : ""}`}
      aria-label={title}
    >
      <div className="avatar-reaction-art">
        <AvatarPortrait
          avatar={avatarFor(actor)}
          fullBody
          mood={mood}
          animated
          alt={`${actor.name}'s character ${mood === "sad" ? "looking sad and ready to try again" : mood === "celebrate" ? "celebrating" : "feeling determined"}`}
        />
        {mood === "celebrate" && (
          <span className="reaction-confetti" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} style={{ "--piece": i }} />
            ))}
          </span>
        )}
      </div>
      <div>
        <strong>{title}</strong>
        {detail && <p>{detail}</p>}
      </div>
    </section>
  );
}
