import { profilePoses } from "./avatar-profile-poses.js";
import { profileGestures } from "./avatar-profile-gestures.js";
import { profileBackgroundSvg } from "./avatar-profile-backgrounds.js";

export function profileSticker(a, base) {
  const p = a.profilePose;
  const { back, front } = profileGestures(a);
  const tilt =
    {
      hello: -3,
      peace: -4,
      thinker: 3,
      cheek: 5,
      wink: -4,
      sideWave: 3,
      fingerHeart: -3,
      kiss: -3,
      coffee: 2,
      stretch: 3,
    }[p] || 0;
  let inside = base.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  inside = inside.replace("rotate(0 160 150)", `rotate(${tilt} 160 150)`);
  // Arms emerge from the selected garment and sit behind the head and accessories.
  inside = inside.replace(
    '<path class="sticker-neck"',
    `${back}<path class="sticker-neck"`,
  );
  const wink =
    p === "wink"
      ? `<style>.eye-left{display:none}</style><g transform="rotate(${tilt} 160 150)"><path d="M125 131Q135 137 145 129" fill="none" stroke="#352b25" stroke-width="3" stroke-linecap="round"/></g>`
      : "";
  const label = (
    profilePoses.find((x) => x.key === p)?.label || "Classic portrait"
  ).replaceAll("&", "&amp;");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 -12 240 300" role="img" aria-label="${label}"><style>.sticker-arm-left,.sticker-arm-right{display:none}</style>${profileBackgroundSvg(a.profileBackground)}${inside}${front}${wink}</svg>`;
}
