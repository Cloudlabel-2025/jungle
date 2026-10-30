import { levelImage } from "@/lib/level-images";

export default function LevelScene({ level }) {
  const image = levelImage(level);
  return (
    <img
      className="project-preview-image"
      src={image.src}
      alt={image.alt}
      width={768}
      height={512}
      decoding="async"
    />
  );
}
