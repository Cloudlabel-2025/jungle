"use client";
import { stickerImage } from "@/lib/avatar-stickers";
export default function AvatarPortrait({
  avatar,
  fullBody = false,
  mood = "ready",
  animated = false,
  profile = true,
  alt = "",
  ...props
}) {
  return (
    <img
      {...props}
      src={stickerImage(avatar, {
        portrait: !fullBody,
        mood,
        animated,
        profile,
      })}
      alt={alt}
      decoding="async"
    />
  );
}
