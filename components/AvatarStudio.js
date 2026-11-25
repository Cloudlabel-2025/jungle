"use client";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  RotateCcw,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Modal } from "./ui";
import {
  avatarFor,
  avatarOptions,
  avatarColors,
  avatarColorways,
  avatarRanges,
  defaultAvatar,
} from "@/lib/avatar";
import AvatarPortrait from "./AvatarPortrait";
import { profilePoses } from "@/lib/avatar-profile-poses";
import { profileBackgrounds } from "@/lib/avatar-profile-backgrounds";

const labels = {
  ...Object.fromEntries(profileBackgrounds.map((b) => [b.key, b.label])),
  ...Object.fromEntries(profilePoses.map((p) => [p.key, p.label])),
  crop: "Close crop",
  swept: "Side swept",
  curls: "Soft curls",
  afro: "Afro",
  bob: "Bob",
  long: "Long waves",
  braids: "Braids",
  bun: "Top bun",
  bald: "Shaved",
  fade: "Textured fade",
  curtains: "Curtain fringe",
  wolf: "Wolf cut",
  pixie: "Choppy pixie",
  locs: "Locs",
  ponytail: "High ponytail",
  spaceBuns: "Space buns",
  wavy: "Beach waves",
  quiff: "Lifted quiff",
  buzz: "Buzz cut",
  frenchCrop: "French crop",
  mullet: "Modern mullet",
  butterfly: "Butterfly layers",
  sideBraid: "Side braid",
  doublePuffs: "Double puffs",
  halfUp: "Half-up knot",
  slickBack: "Slicked back",
  bixie: "Bixie cut",
  fishtail: "Fishtail braid",
  cornrows: "Cornrows",
  twinTails: "Twin ponytails",
  shag: "Curly shag",
  topKnot: "Top knot",
  sidePart: "Classic side part",
  explorer: "Trail jacket",
  hoodie: "Cozy hoodie",
  varsity: "Varsity jacket",
  shirt: "Everyday shirt",
  suit: "Tailored suit",
  kurta: "Embroidered kurta",
  dress: "Day dress",
  sari: "Draped sari",
  bomber: "Street bomber",
  denim: "Denim layers",
  tracksuit: "Retro tracksuit",
  cargo: "Utility cargos",
  dungarees: "Denim overalls",
  jersey: "Team jersey",
  lehenga: "Festive lehenga",
  robe: "Celestial mage",
  cardigan: "Layered cardigan",
  puffer: "Puffer vest",
  sweater: "Cable-knit sweater",
  polo: "Sport polo",
  jumpsuit: "Utility jumpsuit",
  sherwani: "Festive sherwani",
  none: "None",
  round: "Round",
  square: "Square",
  sunglasses: "Sun glasses",
  stubble: "Stubble",
  beard: "Full beard",
  moustache: "Moustache",
  earrings: "Hoop earrings",
  headphones: "Headphones",
  cap: "Trail cap",
  beanie: "Ribbed beanie",
  bucket: "Bucket hat",
  beret: "Artist beret",
  bow: "Ribbon bow",
  flower: "Flower clip",
  studs: "Star studs",
  crown: "Explorer crown",
  scarf: "Camp scarf",
  solid: "Solid colour",
  highlights: "Highlights",
  ombre: "Ombré",
  split: "Split dye",
  boots: "Trail boots",
  sneakers: "Sneakers",
  formal: "Dress shoes",
  soft: "Calm",
  smile: "Soft smile",
  grin: "Big smile",
  relaxed: "Relaxed",
  confident: "Hands on hips",
  wave: "Say hello",
  balanced: "Balanced",
  slender: "Slender",
  broad: "Broad",
};
const faceLabels = {
  faceWidth: "Face width",
  faceLength: "Face length",
  jaw: "Jaw shape",
  eyeSize: "Eye size",
  eyeSpacing: "Eye spacing",
  nose: "Nose width",
  mouth: "Mouth width",
  brows: "Brow arch",
};
export default function AvatarStudio({ data, act, close }) {
  const [avatar, setAvatar] = useState(() => avatarFor(data.user));
  const [view, setView] = useState("body"),
    [backdrop, setBackdrop] = useState("sage");
  const [previewMood, setPreviewMood] = useState("ready");
  const [profileCollection, setProfileCollection] = useState("poses");
  const [tab, setTab] = useState("wardrobe"),
    [camera, setCamera] = useState(false),
    [cameraPending, setCameraPending] = useState(false),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const video = useRef(null),
    stream = useRef(null),
    alive = useRef(true),
    scanId = useRef(0),
    cameraId = useRef(0);
  const update = (key, value) => setAvatar((a) => ({ ...a, [key]: value }));
  function stopCamera() {
    cameraId.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (alive.current) {
      setCamera(false);
      setReady(false);
      setCameraPending(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      scanId.current++;
      cameraId.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (camera && video.current && stream.current) {
      video.current.srcObject = stream.current;
      video.current.play().catch(() => {
        setError(
          "Camera playback failed. Try again or use manual customization.",
        );
        stopCamera();
      });
    }
  }, [camera]);
  async function openCamera() {
    if (cameraPending) return;
    setError("");
    setMessage("");
    const id = ++cameraId.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Camera access requires HTTPS and a supported browser. You can create your avatar manually.",
      );
      return;
    }
    try {
      setCameraPending(true);
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (!alive.current || id !== cameraId.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      setCameraPending(false);
      setCamera(true);
    } catch (e) {
      if (alive.current && id === cameraId.current) {
        setCameraPending(false);
        setError(
          e.name === "NotAllowedError"
            ? "Camera access wasn’t allowed. You can enable it in your browser or continue manually."
            : "No usable camera was found. Try another camera or customize manually.",
        );
      }
    }
  }
  async function scan() {
    if (!ready || busy) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.current.videoWidth;
    canvas.height = video.current.videoHeight;
    canvas.getContext("2d").drawImage(video.current, 0, 0);
    await createLikeness(canvas);
  }
  async function photo(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setError("Choose a JPEG, PNG or WebP photo smaller than 8 MB.");
      return;
    }
    stopCamera();
    setBusy(true);
    setError("");
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      if (!alive.current) return;
      const canvas = document.createElement("canvas"),
        scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas
        .getContext("2d")
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      await createLikeness(canvas);
    } catch {
      if (alive.current) {
        setError(
          "This photo couldn’t be read. Try another photo or customize manually.",
        );
        setBusy(false);
      }
    } finally {
      bitmap?.close();
    }
  }
  async function createLikeness(canvas) {
    const id = ++scanId.current;
    stopCamera();
    setBusy(true);
    setError("");
    setMessage(
      "Creating your likeness on this device… The first scan loads the face model.",
    );
    try {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const { scanAvatar } = await import("@/lib/avatar-scan");
      const features = await scanAvatar(canvas);
      if (alive.current && id === scanId.current) {
        setAvatar((a) => ({ ...a, ...features }));
        setTab("face");
        setMessage(
          "Likeness created. Fine-tune the face, then choose your hair and outfit. Your photo was discarded.",
        );
      }
    } catch (e) {
      if (alive.current && id === scanId.current) {
        setMessage("");
        setError(
          e.message?.includes("face") ||
            e.message?.includes("frame") ||
            e.message?.includes("light") ||
            e.message?.includes("ahead")
            ? e.message
            : "The face model couldn’t load. Check the connection and retry, or continue manually.",
        );
      }
    } finally {
      canvas.width = canvas.height = 0;
      if (alive.current && id === scanId.current) setBusy(false);
    }
  }
  async function save() {
    if (busy) return;
    stopCamera();
    setBusy(true);
    setError("");
    try {
      if (
        await act(
          "gamer/character",
          { avatar, version: data.user.avatarVersion || 0 },
          "Personal avatar saved. Your team will see your new look.",
        )
      )
        close();
      else
        setError(
          "Your avatar wasn’t saved. Close the studio, refresh the page and try again.",
        );
    } catch (e) {
      if (alive.current)
        setError(e.message || "Could not save. Please try again.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function choices(key, title) {
    return (
      <fieldset className="avatar-options">
        <legend>{title}</legend>
        <div>
          {avatarOptions[key].map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={avatar[key] === value}
              onClick={() => update(key, value)}
              disabled={busy}
            >
              {[
                "outfit",
                "hair",
                "glasses",
                "facialHair",
                "accessory",
                "expression",
                "hairDye",
                "profilePose",
                "profileBackground",
              ].includes(key) && (
                <AvatarPortrait
                  avatar={{ ...avatar, [key]: value }}
                  fullBody={key === "outfit"}
                  profile={key === "profilePose" || key === "profileBackground"}
                  alt=""
                />
              )}
              <span>{labels[value] || value}</span>
              {avatar[key] === value && <Check size={14} />}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }
  function colors(key, title) {
    return (
      <fieldset className="avatar-palette">
        <legend>{title}</legend>
        <div>
          {avatarColors[key].map((color) => (
            <button
              type="button"
              key={color}
              style={{ background: color }}
              aria-label={`${title} ${color}`}
              aria-pressed={avatar[key] === color}
              onClick={() => update(key, color)}
              disabled={busy}
            >
              {avatar[key] === color && <Check size={15} />}
            </button>
          ))}
          <label className="avatar-custom-color">
            Custom
            <input
              type="color"
              aria-label={`Custom ${title.toLowerCase()}`}
              value={avatar[key]}
              onChange={(e) => update(key, e.target.value)}
              disabled={busy}
            />
          </label>
        </div>
      </fieldset>
    );
  }
  return (
    <Modal
      title="Your explorer. Every emotion."
      kicker="THE EXPLORER'S HIDEOUT"
      wide
      portal
      close={() => {
        if (!busy) close();
      }}
    >
      <div className="avatar-studio avatar-studio-deluxe" aria-busy={busy}>
        <section
          className={`avatar-stage avatar-backdrop-${backdrop}`}
          aria-label="Live avatar preview"
        >
          <div className="avatar-stage-top">
            <span>
              <Sparkles size={14} /> MADE FOR YOUR VOYAGE
            </span>
            <span>CHARACTER STICKERS</span>
          </div>
          <div className="avatar-body-preview">
            <AvatarPortrait
              avatar={avatar}
              fullBody={view !== "face" && tab !== "profile"}
              profile={tab === "profile"}
              mood={previewMood}
              animated
              alt={`${data.user.name}'s ${previewMood} character sticker`}
            />
          </div>
          <div
            className="avatar-preview-tools"
            aria-label="Preview controls"
            style={{ display: tab === "profile" ? "none" : undefined }}
          >
            <button
              type="button"
              aria-pressed={view === "body"}
              onClick={() => setView("body")}
            >
              Full look
            </button>
            <button
              type="button"
              aria-pressed={view === "face"}
              onClick={() => setView("face")}
            >
              Face detail
            </button>
          </div>
          <div
            className="avatar-mood-tools"
            style={{ display: tab === "profile" ? "none" : undefined }}
            aria-label="Preview character reactions"
          >
            {[
              ["ready", "Ready"],
              ["celebrate", "Celebrate"],
              ["sad", "Try again"],
            ].map(([mood, label]) => (
              <button
                type="button"
                key={mood}
                aria-pressed={previewMood === mood}
                onClick={() => {
                  setPreviewMood(mood);
                  setView("body");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="avatar-stage-bottom">
            <span className="avatar-name-caption">EXPLORER PROFILE</span>
            <h3>{data.user.name}</h3>
            <p>
              {labels[avatar.outfit]} · {labels[avatar.hair]}
            </p>
            <span className="avatar-drag-hint">
              Your look. Your reactions. Your adventure.
            </span>
            <div
              className="avatar-backdrops"
              aria-label="Studio background"
              style={{ display: tab === "profile" ? "none" : undefined }}
            >
              {["sage", "sand", "lilac"].map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`${{ sage: "Forest", sand: "Camp", lilac: "Nightfall" }[color]} background`}
                  aria-pressed={backdrop === color}
                  onClick={() => setBackdrop(color)}
                />
              ))}
            </div>
          </div>
        </section>
        <section className="avatar-workbench">
          <nav aria-label="Avatar customization">
            {[
              ["wardrobe", Shirt, "Wardrobe"],
              ["face", SlidersHorizontal, "Face & hair"],
              ["personality", Sparkles, "Expressions"],
              ["profile", UserRound, "Profile picture"],
              ["camera", Camera, "Face scan"],
            ].map(([key, Icon, label]) => (
              <button
                type="button"
                key={key}
                aria-pressed={tab === key}
                onClick={() => {
                  if (tab === "camera") stopCamera();
                  setTab(key);
                  if (key === "face") setView("face");
                  if (key === "wardrobe" || key === "personality")
                    setView("body");
                }}
                disabled={busy}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
          <div className="avatar-controls">
            <fieldset className="avatar-style">
              <legend>Choose your style</legend>
              <div>
                {["male", "female"].map((style) => (
                  <button
                    type="button"
                    key={style}
                    aria-pressed={avatar.style === style}
                    onClick={() => update("style", style)}
                    disabled={busy}
                  >
                    <UserRound size={17} />
                    {style === "male" ? "Male" : "Female"}
                  </button>
                ))}
              </div>
              <p>Your style. Every look is yours to try.</p>
            </fieldset>
            {tab === "wardrobe" && (
              <>
                <div className="avatar-collection-heading">
                  <span>THE EVERYDAY COLLECTION</span>
                  <h3>Find your signature look.</h3>
                  <p>
                    Trail-ready layers, easy streetwear and a little occasion
                    dressing.
                  </p>
                </div>
                {choices("outfit", "Your wardrobe")}
                <fieldset className="avatar-colorways" disabled={busy}>
                  <legend>Outfit colour combinations</legend>
                  <div>
                    {avatarColorways.map(({ name, ...colors }) => (
                      <button
                        type="button"
                        key={name}
                        aria-pressed={Object.entries(colors).every(
                          ([key, value]) => avatar[key] === value,
                        )}
                        onClick={() =>
                          setAvatar((current) => ({ ...current, ...colors }))
                        }
                      >
                        <span aria-hidden="true">
                          {Object.values(colors).map((color) => (
                            <i key={color} style={{ background: color }} />
                          ))}
                        </span>
                        {name}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {colors("topColor", "Outfit color")}
                {colors("bottomColor", "Trousers color")}
                {colors("accentColor", "Details color")}
                {choices("shoes", "Footwear")}
                {choices("accessory", "Accessories")}
              </>
            )}
            {tab === "face" && (
              <>
                {choices("hair", "Hair studio")}
                {colors("hairColor", "Hair color")}
                {choices("hairDye", "Hair colour style")}
                {avatar.hairDye !== "solid" &&
                  colors("hairAccentColor", "Secondary hair colour")}
                {colors("skin", "Skin tone")}
                {colors("eyeColor", "Eye color")}
                {choices("facialHair", "Facial hair")}
                {choices("glasses", "Eyewear")}
                <fieldset className="avatar-sliders">
                  <legend>Make it feel like you</legend>
                  {Object.entries(avatarRanges).map(([key, [min, max]]) => (
                    <label key={key}>
                      {faceLabels[key]}
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step="0.01"
                        value={avatar[key]}
                        onChange={(e) => update(key, Number(e.target.value))}
                        disabled={busy}
                      />
                    </label>
                  ))}
                </fieldset>
              </>
            )}
            {tab === "profile" && (
              <>
                <div className="avatar-collection-heading">
                  <span>YOUR DISPLAY PICTURE</span>
                  <h3>Make your profile yours.</h3>
                  <p>
                    Choose your pose and background. Save your avatar to use
                    them in your profile and team portraits.
                  </p>
                </div>
                <div
                  className="avatar-profile-tools"
                  aria-label="Profile picture settings"
                >
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={profileCollection === "poses"}
                    onClick={() => setProfileCollection("poses")}
                  >
                    Poses · 24
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={profileCollection === "backgrounds"}
                    onClick={() => setProfileCollection("backgrounds")}
                  >
                    Backgrounds · 12
                  </button>
                </div>
                {profileCollection === "poses"
                  ? choices("profilePose", "Profile picture pose")
                  : choices("profileBackground", "Profile background")}
              </>
            )}
            {tab === "personality" && (
              <>
                <div className="avatar-collection-heading">
                  <span>A LITTLE CHARACTER</span>
                  <h3>Let your personality show.</h3>
                  <p>A familiar smile. A confident stance. A friendly hello.</p>
                </div>
                <div
                  className="avatar-reaction-pack"
                  aria-label="Your reaction stickers"
                >
                  {[
                    ["ready", "Ready"],
                    ["celebrate", "Congratulations!"],
                    ["cheer", "Great work!"],
                    ["sad", "Try again"],
                    ["determined", "Keep going"],
                    ["wave", "Hello!"],
                  ].map(([mood, label]) => (
                    <button
                      type="button"
                      key={mood}
                      aria-pressed={previewMood === mood}
                      onClick={() => {
                        setPreviewMood(mood);
                        setView("body");
                      }}
                    >
                      <AvatarPortrait avatar={avatar} fullBody mood={mood} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                {choices("expression", "Your expression")}
                {choices("pose", "Your stance")}
                {choices("body", "Build & proportions")}
              </>
            )}
            {tab === "camera" && (
              <section className="avatar-camera">
                <h3>A little more like you</h3>
                <p>
                  Take a single camera snapshot to suggest your face shape,
                  feature proportions and skin tone. This creates a stylized
                  likeness, not an exact replica.
                </p>
                <div className="avatar-camera-frame">
                  {camera ? (
                    <>
                      <video
                        ref={video}
                        autoPlay
                        playsInline
                        muted
                        onLoadedData={() => setReady(true)}
                      />
                      <div className="avatar-face-guide" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <Camera size={42} />
                      <span>Your camera is off</span>
                    </>
                  )}
                </div>
                {camera ? (
                  <div className="avatar-camera-actions">
                    <button
                      className="btn primary"
                      type="button"
                      disabled={!ready || busy}
                      onClick={scan}
                    >
                      Capture & create
                    </button>
                    <button className="btn" type="button" onClick={stopCamera}>
                      Turn camera off
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn primary"
                    type="button"
                    onClick={openCamera}
                    disabled={busy || cameraPending}
                  >
                    {cameraPending
                      ? "Waiting for camera permission…"
                      : "Enable camera"}
                  </button>
                )}
                <label className="avatar-photo-input">
                  Or choose a photo from this device
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Choose a local face photo"
                    onChange={photo}
                    disabled={busy}
                  />
                </label>
                <p className="avatar-privacy">
                  Camera access is optional. Face the camera alone, with your
                  whole face in even light. The snapshot and landmarks stay on
                  this device and are discarded after scanning. Only your
                  editable avatar settings are saved.
                </p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    stopCamera();
                    setTab("face");
                  }}
                  disabled={busy}
                >
                  Customize manually
                </button>
              </section>
            )}
          </div>
          <footer>
            {message && <p role="status">{message}</p>}
            {error && (
              <p role="alert" className="avatar-error">
                {error}
              </p>
            )}
            <div>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => {
                  setAvatar(defaultAvatar(avatar.style));
                  setMessage("Avatar reset. Save to apply your new look.");
                }}
              >
                <RotateCcw size={15} />
                Reset look
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={save}
                disabled={busy}
              >
                {busy ? "Working…" : "Save my avatar"}
                <Check size={16} />
              </button>
            </div>
          </footer>
        </section>
      </div>
    </Modal>
  );
}
