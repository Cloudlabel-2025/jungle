import test from "node:test";
import assert from "node:assert/strict";
import { profilePoses } from "../lib/avatar-profile-poses.js";
import { profileBackgrounds } from "../lib/avatar-profile-backgrounds.js";
import { defaultAvatar, avatarOptions, validateAvatar } from "../lib/avatar.js";
import {
  stickerSvg,
  stickerImage,
  stickerMoods,
  resultSticker,
} from "../lib/avatar-stickers.js";
test("confirmed outcomes choose reactions without treating pending review or technical errors as losses", () => {
  assert.equal(resultSticker({ completed: true, stars: 1 }), "celebrate");
  assert.equal(resultSticker({ status: "CLEARED", stars: 3 }), "celebrate");
  assert.equal(resultSticker({ status: "RETURNED" }), "sad");
  assert.equal(
    resultSticker({ completed: false, status: "REVIEW_REQUIRED" }),
    "determined",
  );
  assert.equal(resultSticker({ completed: false, status: "FAILED" }), "sad");
  assert.equal(resultSticker({ error: "Network request failed" }), null);
  assert.equal(resultSticker(null), null);
});
test("every reaction preserves the selected face, hair and clothes without changing saved settings", () => {
  const avatar = {
      ...defaultAvatar("female"),
      hair: "braids",
      skin: "#653d2c",
      outfit: "sari",
      topColor: "#795d9b",
      eyeColor: "#52798a",
      nose: 1.2,
    },
    before = structuredClone(avatar);
  const happy = stickerSvg(avatar, { mood: "celebrate", animated: true }),
    sad = stickerSvg(avatar, { mood: "sad", animated: true });
  for (const svg of [happy, sad]) {
    for (const c of [avatar.skin, avatar.topColor, avatar.hairColor])
      assert.ok(svg.includes(c));
    assert.ok(svg.includes("sticker-arm-left"));
    assert.ok(!svg.includes("undefined"));
    assert.ok(!svg.includes("<script"));
    assert.ok(!svg.includes("<image"));
  }
  assert.ok(sad.includes(avatar.eyeColor));
  assert.notEqual(happy, sad);
  assert.ok(sad.includes('class="sticker-tear"'));
  assert.ok(happy.includes("animation:hooray"));
  assert.ok(happy.includes("prefers-reduced-motion:no-preference"));
  assert.deepEqual(avatar, before);
});
test("both styles, all wardrobe and hair choices render for every sticker action", () => {
  for (const style of avatarOptions.style)
    for (const outfit of avatarOptions.outfit)
      for (const hair of avatarOptions.hair)
        for (const mood of stickerMoods) {
          const image = stickerImage(
            { ...defaultAvatar(style), outfit, hair },
            { mood },
          );
          assert.ok(image.startsWith("data:image/svg+xml,"));
          assert.ok(decodeURIComponent(image).endsWith("</svg>"));
          assert.ok(!image.includes("NaN"));
          assert.ok(!decodeURIComponent(image).includes("undefined"));
        }
});
test("existing characters retain their likeness when hair colour styles are introduced", () => {
  const old = {
    ...defaultAvatar("female"),
    hair: "butterfly",
    skin: "#653d2c",
    nose: 1.2,
  };
  delete old.hairDye;
  delete old.hairAccentColor;
  delete old.profilePose;
  delete old.profileBackground;
  const upgraded = validateAvatar(old);
  assert.equal(upgraded.hairDye, "solid");
  assert.equal(upgraded.profilePose, "classic");
  assert.equal(upgraded.profileBackground, "forest");
  assert.equal(upgraded.hair, old.hair);
  assert.equal(upgraded.nose, old.nose);
  assert.equal(upgraded.skin, old.skin);
  assert.throws(() => validateAvatar({ ...upgraded, hairDye: "invalid" }));
  assert.throws(() =>
    validateAvatar({
      ...upgraded,
      hairAccentColor: "url(https://invalid.example)",
    }),
  );
});
test("profile backgrounds preserve the selected pose and character and leave mission reactions unchanged", () => {
  assert.equal(profileBackgrounds.length, 12);
  const a = {
    ...defaultAvatar("female"),
    hair: "braids",
    outfit: "jersey",
    accessory: "flower",
    profilePose: "peace",
    hairDye: "ombre",
    hairAccentColor: "#426cb0",
  };
  const initial = structuredClone(a),
    pictures = new Set();
  const baseReaction = stickerSvg(a, { mood: "celebrate" });
  const initialProfile = stickerSvg(a, { portrait: true });
  const subject = initialProfile.slice(
    initialProfile.indexOf('<defs><linearGradient id="sticker-skin"'),
  );
  for (const { key } of profileBackgrounds) {
    const selected = validateAvatar({ ...a, profileBackground: key });
    const svg = stickerSvg(selected, { portrait: true });
    assert.ok(svg.includes(`data-background="${key}"`));
    assert.ok(svg.endsWith(subject));
    assert.equal(stickerSvg(selected, { mood: "celebrate" }), baseReaction);
    assert.ok(!svg.includes("undefined"));
    assert.ok(!svg.includes("NaN"));
    pictures.add(svg);
  }
  assert.equal(pictures.size, 12);
  assert.deepEqual(a, initial);
  assert.throws(() => validateAvatar({ ...a, profileBackground: "untrusted" }));
});
test("24 distinct saved profile poses preserve appearance and do not change mission reactions", () => {
  assert.equal(profilePoses.length, 24);
  for (const style of avatarOptions.style) {
    const pictures = new Set();
    const a = {
      ...defaultAvatar(style),
      hair: "butterfly",
      hairDye: "ombre",
      hairAccentColor: "#426cb0",
    };
    const reaction = stickerSvg(a, { mood: "celebrate" });
    for (const { key } of profilePoses) {
      const selected = validateAvatar({ ...a, profilePose: key });
      const svg = stickerSvg(selected, { portrait: true });
      assert.ok(svg.includes('viewBox="40 -12 240 300"'));
      assert.ok(!svg.includes("undefined"));
      assert.ok(!svg.includes("NaN"));
      assert.ok(svg.includes(a.hairAccentColor));
      assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(svg));
      pictures.add(svg);
      assert.equal(stickerSvg(selected, { mood: "celebrate" }), reaction);
    }
    assert.equal(pictures.size, 24);
    assert.throws(() => validateAvatar({ ...a, profilePose: "untrusted" }));
  }
});
test("hair colour treatments and accessories render safely in portraits and reactions", () => {
  for (const style of avatarOptions.style)
    for (const hairDye of avatarOptions.hairDye)
      for (const accessory of avatarOptions.accessory)
        for (const mood of stickerMoods) {
          const a = {
            ...defaultAvatar(style),
            hair: "twinTails",
            hairDye,
            hairAccentColor: "#426cb0",
            accessory,
          };
          assert.deepEqual(validateAvatar(a), a);
          for (const portrait of [false, true]) {
            const svg = stickerSvg(a, { portrait, mood });
            assert.ok(!svg.includes("undefined"));
            assert.ok(!svg.includes("NaN"));
            assert.ok(svg.includes("#426cb0"));
            if (hairDye !== "solid")
              assert.ok(svg.includes('fill="url(#sticker-hair)"'));
          }
        }
});
test("refined gestures retain the exact selected hair, garments and accessories across every pose", () => {
  for (const look of [
    {
      style: "female",
      hair: "braids",
      outfit: "jersey",
      accessory: "flower",
      glasses: "round",
    },
    {
      style: "male",
      hair: "locs",
      outfit: "hoodie",
      accessory: "headphones",
      glasses: "none",
    },
    {
      style: "female",
      hair: "butterfly",
      outfit: "sari",
      accessory: "earrings",
      glasses: "square",
    },
  ]) {
    const avatar = {
      ...defaultAvatar(look.style),
      ...look,
      hairDye: "split",
      hairAccentColor: "#426cb0",
      skin: "#653d2c",
      topColor: "#aa526c",
    };
    const original = structuredClone(avatar);
    const base = stickerSvg(avatar);
    const head = base
      .slice(base.indexOf('<g class="sticker-head"'))
      .replace(/<\/svg>$/, "")
      .replace(/rotate\(-?\d+ 160 150\)/g, "");
    const garment = base
      .slice(
        base.indexOf('<g class="sticker-body"'),
        base.indexOf('<path class="sticker-neck"'),
      )
      .trim();
    for (const { key } of profilePoses) {
      const svg = stickerSvg(
        { ...avatar, profilePose: key },
        { portrait: true },
      ).replace(/rotate\(-?\d+ 160 150\)/g, "");
      assert.ok(
        svg.includes(head),
        `${key}: selected head and accessory retained`,
      );
      assert.ok(svg.includes(garment), `${key}: selected garment retained`);
      assert.ok(
        svg.includes(
          `data-sleeves="${look.outfit === "hoodie" ? "long" : "short"}"`,
        ),
      );
      assert.ok(!svg.includes("NaN"));
    }
    assert.deepEqual(avatar, original);
  }
});
