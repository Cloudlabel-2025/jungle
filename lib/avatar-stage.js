import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { sculptAvatar, poseSculpt } from "./avatar-sculpt.js";

export function disposeAvatar(rig) {
  const geometries = new Set(),
    materials = new Set();
  rig.root.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
export function createAvatarStage(canvas, { thumbnail = false } = {}) {
  const renderer = new T.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: thumbnail,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(
    thumbnail ? 1 : Math.min(window.devicePixelRatio || 1, 1.75),
  );
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
  const pmrem = new T.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.35;
  room.dispose();
  pmrem.dispose();
  scene.add(new T.HemisphereLight("#fff9e9", "#8c8c9a", 1.0));
  const key = new T.DirectionalLight("#fff4df", 1.6);
  key.position.set(-3, 5, 5);
  scene.add(key);
  const fill = new T.DirectionalLight("#deebff", 0.8);
  fill.position.set(3, 2, 3);
  scene.add(fill);
  const rim = new T.DirectionalLight("#fff4de", 1.4);
  rim.position.set(1, 3, -3);
  scene.add(rim);
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext("2d"),
    gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 64);
  gradient.addColorStop(0, "rgba(48,45,35,.29)");
  gradient.addColorStop(0.45, "rgba(48,45,35,.12)");
  gradient.addColorStop(1, "rgba(48,45,35,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new T.CanvasTexture(shadowCanvas),
    floor = new T.Mesh(
      new T.PlaneGeometry(1.65, 0.75),
      new T.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      }),
    );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.056;
  scene.add(floor);
  let rig = null,
    view = "body",
    width = 1,
    height = 1,
    yaw = 0.13;
  function resize(w, h) {
    width = Math.max(1, w);
    height = Math.max(1, h);
    renderer.setSize(width, height, false);
    compose();
  }
  function compose() {
    const half = view === "face" ? 0.51 : 1.29,
      target = view === "face" ? 2.0 : 1.28;
    camera.left = (-half * width) / height;
    camera.right = (half * width) / height;
    camera.top = half;
    camera.bottom = -half;
    camera.position.set(0, target, 5);
    camera.lookAt(0, target, 0);
    camera.updateProjectionMatrix();
    floor.visible = view !== "face";
  }
  function setAvatar(avatar) {
    if (rig) {
      scene.remove(rig.root);
      disposeAvatar(rig);
    }
    rig = sculptAvatar(avatar, { detail: !thumbnail });
    scene.add(rig.root);
  }
  function render(time = 1, animate = false) {
    if (!rig) return;
    poseSculpt(rig, time, { animate, studio: true });
    rig.root.rotation.y = yaw;
    renderer.render(scene, camera);
  }
  return {
    resize,
    setAvatar,
    render,
    setView(next) {
      view = next;
      compose();
    },
    setYaw(next) {
      yaw = next;
    },
    getYaw() {
      return yaw;
    },
    dispose() {
      if (rig) disposeAvatar(rig);
      floor.geometry.dispose();
      floor.material.dispose();
      texture.dispose();
      environment.dispose();
      renderer.dispose();
    },
    capture() {
      render();
      return canvas.toDataURL("image/png");
    },
  };
}

let thumbnailStage;
const cache = new Map();
let queue = Promise.resolve();
export function avatarThumbnail(avatar, fullBody = false) {
  const key = JSON.stringify([avatar, fullBody]);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  const work = queue
    .then(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    .then(() => {
      if (cache.has(key)) return cache.get(key);
      thumbnailStage ||= createAvatarStage(document.createElement("canvas"), {
        thumbnail: true,
      });
      thumbnailStage.resize(fullBody ? 180 : 160, fullBody ? 280 : 160);
      thumbnailStage.setAvatar(avatar);
      thumbnailStage.setView(fullBody ? "body" : "face");
      thumbnailStage.setYaw(0.08);
      const image = thumbnailStage.capture();
      cache.set(key, image);
      if (cache.size > 96) cache.delete(cache.keys().next().value);
      return image;
    });
  queue = work.catch(() => {});
  return work;
}
