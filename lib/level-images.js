import { levelHazard } from "./level-hazards.js";

// Stable library IDs are saved with the level definition and attempt snapshot.
export const levelImages = [
  ["thorns", "Thorn bushes", "Hooked thorn bushes barricading a forest trail"],
  ["insects", "Hornet swarm", "Wasps circling a nest above the jungle path"],
  [
    "vines",
    "Strangler vines",
    "Tangled vines and roots blocking a forest passage",
  ],
  ["mud", "Mud pit", "A deep sinking mud pit in a jungle clearing"],
  [
    "poison",
    "Poison grove",
    "Poisonous mushrooms and spores on the forest floor",
  ],
  ["viper", "Viper", "A venomous viper coiled beside a jungle trail"],
  ["bridge", "Broken bridge", "A broken rope bridge suspended above a gorge"],
  ["valley", "Great valley", "Sheer forest cliffs surrounding a misty valley"],
  [
    "animal",
    "Predator territory",
    "A black panther stalking through jungle undergrowth",
  ],
  ["spider", "Spider nest", "A forest spider guarding a webbed passage"],
  ["rockfall", "Rockfall", "Boulders falling above a narrow forest ledge"],
  ["falls", "Raging falls", "Whitewater crashing through a forest gorge"],
  ["fire", "Wildfire", "A wildfire advancing through the forest"],
  ["storm", "Thunderstorm", "Lightning striking a jungle ridge in a storm"],
].map(([key, name, alt]) => ({
  key,
  name,
  alt,
  src: `/images/levels/${key}.webp`,
}));

export function levelImage(level) {
  return (
    levelImages.find((image) => image.key === level?.imageKey) ||
    levelImages.find((image) => image.key === levelHazard(level).artwork) ||
    levelImages[0]
  );
}
