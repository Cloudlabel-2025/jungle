import { brand } from "@/lib/brand.js";

export function VowEmblem({
  className = "",
  decorative = false,
  eager = false,
}) {
  return (
    <img
      className={`vow-emblem ${className}`}
      src={brand.logo}
      alt={decorative ? "" : brand.title}
      aria-hidden={decorative || undefined}
      width={1024}
      height={1024}
      loading={eager ? "eager" : undefined}
      decoding="async"
    />
  );
}
export default function VowBrand({ className = "" }) {
  return (
    <span className={`vow-brand ${className}`}>
      <VowEmblem decorative />
      <span className="vow-brand-copy">
        <strong>{brand.shortName}</strong>
        <span>{brand.name}</span>
      </span>
    </span>
  );
}
