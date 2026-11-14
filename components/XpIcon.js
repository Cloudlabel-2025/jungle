export default function XpIcon({ size = 18 }) {
  return (
    <svg
      className="xp-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ color: "var(--xp-icon-color, #c7adff)", flexShrink: 0 }}
    >
      <path
        d="M12 1.8 21 7v10l-9 5.2L3 17V7Z"
        fill="currentColor"
        fillOpacity=".15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <text
        x="12"
        y="15.5"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Arial, sans-serif"
        fontSize="10"
        fontWeight="800"
        letterSpacing="-.5"
      >
        XP
      </text>
    </svg>
  );
}
