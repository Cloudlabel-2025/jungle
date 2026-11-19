import { brand } from "../lib/brand.js";
export default function manifest() {
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.description,
    start_url: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#061b14",
    theme_color: "#102d20",
    icons: [192, 512].map((size) => ({
      src: `${brand.iconPrefix}-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any",
    })),
  };
}
