import * as THREE from "three";
import {
  createExplorer,
  disposeExplorer,
  poseExplorer,
} from "./camp-explorer-3d.js";

const hash = (value) =>
  [...String(value)].reduce(
    (total, letter) => (total * 31 + letter.charCodeAt(0)) >>> 0,
    0,
  );

export function createCampStage(host, members, onFailure) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.dataset.renderer = "articulated-3d";
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    (-10 * 1672) / 941 / 2,
    (10 * 1672) / 941 / 2,
    5,
    -5,
    0.1,
    100,
  );
  camera.position.set(0, 10, 20);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  scene.add(new THREE.HemisphereLight(0xd5e4c5, 0x344831, 2.3));
  const key = new THREE.DirectionalLight(0xffe3b8, 2.6);
  key.position.set(-4, 8, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc0d8cc, 1);
  fill.position.set(4, 4, -5);
  scene.add(fill);
  const residents = new Map();
  const raycaster = new THREE.Raycaster(),
    floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let start = performance.now(),
    currentTime = 0,
    previous = 0,
    frame,
    count = 0,
    disposed = false,
    lost = false;
  function sync(nextMembers) {
    const desired = new Set(
      nextMembers.filter((m) => m.character).map((m) => m.player._id),
    );
    for (const [id, entry] of residents) {
      const next = nextMembers.find((m) => m.player._id === id);
      if (
        !desired.has(id) ||
        `${next.character.key}-${next.character.variant}` !== entry.signature
      ) {
        scene.remove(entry.rig.root);
        disposeExplorer(entry.rig);
        residents.delete(id);
      }
    }
    for (const member of nextMembers) {
      if (!member.character || residents.has(member.player._id)) continue;
      const { player, character, tent } = member;
      const rig = createExplorer(character.key, character.variant);
      rig.phase = (hash(player._id) % 2500) / 100;
      rig.yaw = ((hash(player._id) % 30) - 15) / 100;
      raycaster.setFromCamera(
        new THREE.Vector2((tent.x / 1672) * 2 - 1, 1 - (tent.y / 941) * 2),
        camera,
      );
      const foot = new THREE.Vector3();
      raycaster.ray.intersectPlane(floor, foot);
      rig.root.position.copy(foot);
      rig.root.scale.setScalar(
        tent.y < 450 ? 0.86 : tent.y < 600 ? 0.94 : 1.04,
      );
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.19, 0.23, 32),
        new THREE.MeshBasicMaterial({
          color: character.color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.014;
      rig.root.add(ring);
      scene.add(rig.root);
      residents.set(player._id, {
        rig,
        ring,
        signature: `${character.key}-${character.variant}`,
      });
    }
    renderer.domElement.dataset.characters = String(residents.size);
    renderer.domElement.dataset.variants = [...residents.values()]
      .map((e) => e.signature)
      .join(",");
  }
  function resize() {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (width && height)
      renderer.setSize(Math.round(width), Math.round(height), false);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const contextLost = (event) => {
    event.preventDefault();
    lost = true;
    onFailure?.();
  };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  sync(members);
  resize();
  function animate(now) {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    if (document.hidden || lost || now - previous < 32) return;
    previous = now;
    currentTime = (now - start) / 1000;
    for (const { rig } of residents.values()) poseExplorer(rig, currentTime);
    renderer.render(scene, camera);
    count++;
    if (count % 15 === 0) {
      renderer.domElement.dataset.frame = String(count);
      renderer.domElement.dataset.gestures = [...residents.values()]
        .map((e) => e.rig.gesture)
        .join(",");
    }
  }
  frame = requestAnimationFrame(animate);
  return {
    sync,
    greet(id) {
      const entry = residents.get(id);
      if (entry) entry.rig.waveAt = currentTime;
    },
    turn(id, angle) {
      const entry = residents.get(id);
      if (entry) entry.rig.yaw += angle;
    },
    select(id) {
      for (const [key, entry] of residents)
        entry.ring.material.opacity = key === id ? 0.85 : 0;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      residents.forEach((entry) => disposeExplorer(entry.rig));
      residents.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
