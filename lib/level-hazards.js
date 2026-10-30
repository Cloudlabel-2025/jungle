// Stable art keys are independent of project numbers. Future authored levels can
// select hazardKey without modifying the map or creating another icon component.
const families = [
  [
    "thorns",
    "Vegetation",
    ["Thorn Barricade", "Razor Brambles", "Briar Passage"],
    "Hooked thorns close across the trail.",
  ],
  [
    "insects",
    "Insects",
    ["Hornet Swarm", "Wasp Colony", "Stinging Canopy"],
    "Sharp wings and hidden stingers fill the canopy.",
  ],
  [
    "vines",
    "Vegetation",
    ["Strangler Vines", "Root Labyrinth", "Hanging Snare"],
    "Twisting roots and vines choke the passage.",
  ],
  [
    "mud",
    "Terrain",
    ["Sinking Mud", "Quicksand Basin", "Blackwater Bog"],
    "The ground gives way beneath the surface.",
  ],
  [
    "poison",
    "Vegetation",
    ["Poison Grove", "Deathcap Hollow", "Toxic Spores"],
    "Poisonous growth hides among the forest floor.",
  ],
  [
    "viper",
    "Animals",
    ["Viper Hollow", "Serpent Den", "Venom Trail"],
    "A coiled serpent guards the narrow trail.",
  ],
  [
    "bridge",
    "Structures",
    ["Broken Bridge", "Rotten Timber Crossing", "Severed Rope Crossing"],
    "Snapped ropes and missing planks hang over the abyss.",
  ],
  [
    "valley",
    "Terrain",
    ["Great Valley", "Bottomless Rift", "Sheer Cliff Pass"],
    "A vast chasm divides the route ahead.",
  ],
  [
    "falls",
    "Water",
    ["Raging Falls", "Flooded Gorge", "Whitewater Crossing"],
    "The river crashes between jagged rock walls.",
  ],
  [
    "animal",
    "Animals",
    ["Predator Territory", "Panther Ambush", "Wolf Trail"],
    "Claw marks and heavy tracks signal a predator nearby.",
  ],
  [
    "spider",
    "Insects",
    ["Spider Nest", "Webbed Passage", "Arachnid Hollow"],
    "Silken traps seal the passage.",
  ],
  [
    "rockfall",
    "Terrain",
    ["Rockfall Ridge", "Crumbling Ledge", "Boulder Run"],
    "Fractured stone threatens the trail below.",
  ],
  [
    "fire",
    "Weather",
    ["Wildfire Front", "Ember Grove", "Burning Thicket"],
    "Flames consume the dry forest ahead.",
  ],
  [
    "storm",
    "Weather",
    ["Thunder Ridge", "Lightning Strike", "Stormfall Crossing"],
    "Lightning splits the canopy above the exposed route.",
  ],
];
export const hazardCategories = [
  "Animals",
  "Insects",
  "Vegetation",
  "Terrain",
  "Structures",
  "Water",
  "Weather",
];
export const hazardLibrary = families.flatMap(
  ([artwork, category, names, description]) =>
    names.map((name, i) => ({
      key: i === 0 ? artwork : `${artwork}-${i + 1}`,
      artwork,
      category,
      name,
      description,
    })),
);
// The current ten projects keep their IDs and difficulty order. Their visual
// identities follow the terrain along the evenly spaced map sequence.
export const levelHazards = [
  "thorns",
  "insects",
  "vines",
  "poison",
  "mud",
  "bridge",
  "valley-3",
  "rockfall",
  "viper",
  "animal",
].map((key) => hazardLibrary.find((h) => h.key === key));
export function levelHazard(level) {
  const key = typeof level === "string" ? level : level?.hazardKey;
  const selected = key && hazardLibrary.find((hazard) => hazard.key === key);
  const number = typeof level === "number" ? level : level?.number;
  return selected || levelHazards[number - 1] || levelHazards[0];
}
