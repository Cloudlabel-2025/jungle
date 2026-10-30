// Coordinates are percentages of each original 3:1 terrain illustration.
// A west-to-east zigzag: every consecutive stop is 550px apart in the
// 6000px world. Symbols follow the nearby terrain without crowding the bridge.
export const terrainStops = [
  { region: 0, x: 23.5, y: 68, feature: "Western undergrowth" },
  { region: 0, x: 51, y: 34, feature: "Canopy beside the fallen timber" },
  { region: 0, x: 78.5, y: 68, feature: "Eastern vine-covered root grove" },
  { region: 1, x: 6, y: 34, feature: "Dense growth before the crossing" },
  {
    region: 1,
    x: 33.5,
    y: 78,
    feature: "Lower muddy crossing and stepping stones",
  },
  { region: 1, x: 61, y: 49, feature: "Rope bridge over the chasm" },
  { region: 1, x: 88.5, y: 68, feature: "Far cliff rim beyond the bridge" },
  { region: 2, x: 16, y: 34, feature: "Jagged eastern cliffs" },
  { region: 2, x: 43.5, y: 68, feature: "Root-covered stone ruins" },
  {
    region: 2,
    x: 71,
    y: 34,
    feature: "Canopy and predator cover above the ruins",
  },
];

export function terrainPosition(level, { width, height, chapters = 1 }) {
  const chapter = Math.floor(((level?.number || 1) - 1) / 10);
  const anchor =
    level?.mapAnchor ||
    terrainStops[((level?.number || 1) - 1) % 10] ||
    terrainStops[0];
  const regionWidth = width / (3 * chapters);
  // Mirror background-size: cover and background-position: center exactly.
  const imageWidth = Math.max(regionWidth, height * 3);
  const imageHeight = imageWidth / 3;
  return {
    x:
      (chapter * 3 + anchor.region) * regionWidth +
      (regionWidth - imageWidth) / 2 +
      (imageWidth * anchor.x) / 100,
    y: (height - imageHeight) / 2 + (imageHeight * anchor.y) / 100,
    feature: anchor.feature,
    labelAbove: anchor.y > 60,
    labelPlacement:
      anchor.labelPlacement || (anchor.y > 60 ? "above" : "below"),
  };
}
