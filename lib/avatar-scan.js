import { featuresFromLandmarks } from "./avatar.js";

export async function scanAvatar(canvas) {
  // Lazy loading keeps the game and manual wardrobe free of the vision runtime.
  const { FaceLandmarker, FilesetResolver } =
    await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks("/vendor/face/wasm");
  const detector = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "/models/face_landmarker.task",
      delegate: "CPU",
    },
    runningMode: "IMAGE",
    numFaces: 2,
  });
  try {
    const faces = detector.detect(canvas).faceLandmarks;
    const shape = featuresFromLandmarks(faces, canvas.width, canvas.height);
    const points = faces[0],
      ctx = canvas.getContext("2d", { willReadFrequently: true });
    function sample(indices) {
      const colors = indices.flatMap((i) => {
        const p = points[i],
          x = Math.round(p.x * canvas.width),
          y = Math.round(p.y * canvas.height);
        const pixels = ctx.getImageData(
          Math.max(0, x - 3),
          Math.max(0, y - 3),
          7,
          7,
        ).data;
        return Array.from({ length: 49 }, (_, n) => [
          pixels[n * 4],
          pixels[n * 4 + 1],
          pixels[n * 4 + 2],
        ]);
      });
      return [0, 1, 2].map(
        (c) =>
          colors.map((v) => v[c]).sort((a, b) => a - b)[
            Math.floor(colors.length / 2)
          ],
      );
    }
    const skin = sample([50, 280, 101, 330]);
    const luminance = skin[0] * 0.2126 + skin[1] * 0.7152 + skin[2] * 0.0722;
    if (luminance < 28 || luminance > 243)
      throw new Error(
        "The lighting hides facial detail. Try soft, even light and scan again.",
      );
    const hex = (rgb) =>
      "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
    // Eye/hair colors remain explicit choices: lighting and occlusion make them unreliable.
    return { ...shape, skin: hex(skin) };
  } finally {
    detector.close();
  }
}
