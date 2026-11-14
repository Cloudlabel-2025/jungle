import { useId } from "react";

export default function LevelTwoMissionArt({ kind }) {
  const id = useId().replaceAll(":", "");
  return (
    <svg
      className={`l2-mission-art art-${kind}`}
      viewBox="0 0 460 270"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop stopColor="#c9d67c" stopOpacity=".3" />
          <stop offset="1" stopColor="#c9d67c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-paper`} x2=".2" y2="1">
          <stop stopColor="#eff0c6" />
          <stop offset="1" stopColor="#9daf76" />
        </linearGradient>
        <linearGradient id={`${id}-metal`} x2="1" y2="1">
          <stop stopColor="#69895c" />
          <stop offset="1" stopColor="#153b2c" />
        </linearGradient>
      </defs>
      <ellipse cx="230" cy="155" rx="205" ry="140" fill={`url(#${id}-halo)`} />
      <g fill="none" stroke="#d5df9e" opacity=".2">
        <ellipse cx="230" cy="226" rx="170" ry="27" />
        <ellipse cx="230" cy="226" rx="135" ry="19" />
        <path d="M60 226h340M230 199v54" />
      </g>
      {kind === "signals" ? (
        <>
          <g className="l2-art-float">
            <g transform="translate(116 52) rotate(-13 65 80)">
              <rect
                x="5"
                y="8"
                width="124"
                height="155"
                rx="12"
                fill="#041b1466"
              />
              <rect
                width="124"
                height="155"
                rx="10"
                fill={`url(#${id}-paper)`}
                stroke="#f1f2c4"
                strokeWidth="2"
              />
              <path
                d="M23 30h78M23 46h55M23 89h77M23 105h58M23 121h66"
                stroke="#44613e"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <circle cx="95" cy="130" r="16" fill="#264e39" />
              <path
                d="m88 130 5 5 9-11"
                fill="none"
                stroke="#ecedb1"
                strokeWidth="4"
              />
            </g>
          </g>
          <g className="l2-art-float alternate">
            <g transform="translate(234 70) rotate(12 62 78)">
              <rect
                x="5"
                y="8"
                width="124"
                height="155"
                rx="12"
                fill="#041b1466"
              />
              <rect
                width="124"
                height="155"
                rx="10"
                fill="#284f3d"
                stroke="#b9d08c"
                strokeWidth="2"
              />
              <path
                d="M23 30h78M23 46h55M23 89h77M23 105h58M23 121h66"
                stroke="#a9c58a"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <circle cx="95" cy="130" r="16" fill="#deba65" />
              <path
                d="m88 123 14 14m0-14-14 14"
                stroke="#3d4728"
                strokeWidth="4"
              />
            </g>
          </g>
          <path
            className="l2-art-signal"
            d="M81 69q-26 27 0 54m-12-68q-40 41 0 82M377 91q25 24 0 48m12-61q38 37 0 74"
            stroke="#ddde9d"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <g transform="translate(215 28)">
            <circle r="24" fill="#dbbd70" stroke="#fff2b2" strokeWidth="2" />
            <path
              d="M-6-6q0-10 9-7t-2 14v4m0 6v2"
              fill="none"
              stroke="#33492e"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
        </>
      ) : (
        <>
          <g className="l2-art-float">
            <circle cx="210" cy="133" r="95" fill="#0b3027" stroke="#b9cf87" strokeWidth="3" />
            <g fill="none" stroke="#95b578" opacity=".45">
              <circle cx="210" cy="133" r="65" />
              <circle cx="210" cy="133" r="33" />
              <path d="M115 133h190M210 38v190" />
            </g>
            <path className="l2-art-signal" d="m210 133 65-64a92 92 0 0 1 27 64Z" fill="#cbdc7d33" stroke="#cbdc7d" strokeWidth="2" />
            <g fill="#e2da8f">
              <circle cx="170" cy="96" r="6" />
              <circle cx="237" cy="184" r="5" />
            </g>
            <circle cx="263" cy="104" r="13" fill="none" stroke="#edd594" strokeWidth="3" strokeDasharray="4 4" />
            <path d="m196 140 14-28 14 28-14-6Z" fill="#e7eabd" stroke="#c6d68f" strokeWidth="2" />
          </g>
          <g className="l2-art-float alternate">
            <rect x="305" y="103" width="77" height="112" rx="14" fill="#214d39" stroke="#d9d99a" strokeWidth="2" />
            <path d="M327 103V70m0 0 13-13" stroke="#d9d99a" strokeWidth="5" strokeLinecap="round" />
            <rect x="318" y="119" width="51" height="33" rx="6" fill="#0a2c23" />
            <path className="l2-art-signal" d="m324 136 7-5 6 11 7-17 7 12h11" fill="none" stroke="#dbe99f" strokeWidth="3" />
            <path d="M322 169h43m-43 12h43m-43 12h29" stroke="#c0d08b" strokeWidth="3" strokeLinecap="round" />
          </g>
          <g transform="translate(287 54)">
            <circle r="23" fill="#dbbd70" stroke="#fff2b2" strokeWidth="2" />
            <path d="M-6-6q0-10 9-7t-2 14v4m0 6v2" fill="none" stroke="#33492e" strokeWidth="4" strokeLinecap="round" />
          </g>
        </>
      )}
      <g fill="#e2e9b3">
        <circle cx="80" cy="180" r="2" />
        <circle cx="365" cy="37" r="2" />
        <path d="m341 220 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z" />
      </g>
    </svg>
  );
}
