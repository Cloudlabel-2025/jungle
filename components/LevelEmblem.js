import { levelHazard } from "@/lib/level-hazards.js";

// Engraved warning drawings, selected by stable motif rather than level number.
const artwork = {
  thorns: (
    <>
      <path d="M20 50c0-10 5-15 12-21s11-10 11-17M44 51c-2-9-7-13-15-17S17 26 17 16" />
      <path
        className="hazard-solid"
        d="m19 44-10-5 11-3 2-10 6 7 7-2-5 9Zm17-24 1-10 6 6 10-1-7 8 2 8-10-5ZM18 28 8 25l8-5-1-9 8 6 8-1-7 7 1 8Zm17 19 3-10 5 7 11-1-8 7-1 9-6-8Z"
      />
    </>
  ),
  insects: (
    <>
      <path
        className="hazard-solid"
        d="M29 24 12 9 5 10l3 15 17 9-13 3-5 11 18-3 7-9 7 9 18 3-5-11-13-3 17-9 3-15-7-1-17 15Zm-2-5 5-6 5 6-2 9 5 12-8 17-8-17 5-12Z"
      />
      <path
        className="hazard-cut"
        d="m10 15 16 14-15-7m43-7L38 29l15-7M15 40l12-2m22 2-12-2M27 34h10m-11 6h12m-9 6h6"
      />
      <path d="m24 30-7-2-5 5m28-3 7-2 5 5M32 54v7m-5-44-5-7 1-5m14 12 5-7-1-5" />
    </>
  ),
  vines: (
    <>
      <path
        d="M25 54c21-8-4-19 11-29s6-17 2-19M37 57C15 44 42 33 26 22S20 10 23 7"
        strokeWidth="4"
      />
      <path
        className="hazard-solid"
        d="M30 22C15 23 10 16 10 8c11 0 19 3 20 14Zm6 14c0-13 8-17 19-17-1 12-7 18-19 17ZM26 45C13 47 8 42 7 33c11-1 18 3 19 12Zm12 4c9-7 15-5 19 2-7 7-14 6-19-2Z"
      />
    </>
  ),
  mud: (
    <>
      <path
        className="hazard-solid"
        fillRule="evenodd"
        d="m5 36 9-8 12-3 19 1 13 9-5 12-20 10-20-7Zm6 3 6 7 16 5 16-8 4-7-11-5-15-1-11 4Zm24-5 3-19 5 1-4 17Z"
      />
      <path d="m16 39 11-5 15 2 5 5-15 6-11-5 10-3 7 2m-1-8 7-14-2-8m2 10 9-5M7 54l11 3m30-5 9-3" />
    </>
  ),
  poison: (
    <>
      <path
        className="hazard-solid"
        d="M6 29 15 12 28 7l14 8 10 15-19 3-3 18 9 6-21 2 8-9-1-17Zm29 10 6-9 11-3 9 13-12 3 1 9 6 3-15 1 5-5-1-8Z"
      />
      <path
        className="hazard-cut"
        d="m13 26 9-10 8-3 12 12m-28 5 25-1m-8 6-2 13m13-9 11-2"
      />
      <path d="M8 51 4 43m5 9 5-9m41-26 3-6m-9 5-3-7" />
    </>
  ),
  viper: (
    <>
      <path
        d="M39 39c20 0 20 16-5 16-27 0-29-16-10-18 12-2 17 6 8 9-9 3-14-3-8-8 5-4 11-8 11-15"
        strokeWidth="7"
      />
      <path
        className="hazard-solid"
        d="M34 31c-10-4-14-10-12-18l9-5 14 3 7 8-6 11-6-3Z"
      />
      <path className="hazard-cut" d="m28 17 5 3m8-1 5-3m-12 9 3 5 3-5" />
      <path d="m40 28 1 9-4 4m4-4 4 3" strokeWidth="1.8" />
    </>
  ),
  bridge: (
    <>
      <path d="M7 9v44m50-44v44M7 14c16 13 34 13 50 0M7 24l15 10m20 0 15-10M7 45l15-5m20 0 15 5M13 20v25m7-21v16m24-16v16m7-20v25m-22-24 3-4 3 4" />
      <path
        className="hazard-solid"
        d="m8 40 15-5 3 5-15 5Zm9-6 8-1 3 4-10 2Zm22 2 15 4-2 5-15-5Zm-13 6 5 1-3 15-5-2Zm12-1 4 4-6 9-4-3Z"
      />
    </>
  ),
  valley: (
    <>
      <path
        className="hazard-solid"
        d="M3 9h18l6 12-9 10 6 12-8 18H3Zm58 0H43l-7 12 9 10-7 12 9 18h14Z"
      />
      <path
        className="hazard-cut"
        d="m10 14 7 9-7 9 7 11-6 13m43-42-7 9 8 11-9 9 8 13"
      />
      <path d="m31 6 3 12-5 12 5 12-3 19m-6-8 5 8 6-8" />
    </>
  ),
  spider: (
    <>
      <path
        d="m23 28-9-7-2-11m12 24-13-3-5-9m17 18-13 5-3 10m18-10-9 9v5m25-31 9-7 2-11m-12 24 13-3 5-9m-17 18 13 5 3 10m-18-10 9 9v5"
        strokeWidth="3"
      />
      <ellipse className="hazard-solid" cx="32" cy="38" rx="11" ry="14" />
      <circle className="hazard-solid" cx="32" cy="22" r="7" />
      <path className="hazard-cut" d="m28 37 4-5 4 5-4 5Z" />
      <path d="m29 16-2-5m8 5 2-5M32 4V1" />
    </>
  ),
  falls: (
    <>
      <path
        className="hazard-solid"
        d="M7 12h15v19l-8 8H6Zm35 0h15v27h-8l-7-10Z"
      />
      <path
        d="M26 9v27m6-27v33m6-33v27M8 48c4-7 9-7 14 0 5-7 10-7 15 0 5-7 11-7 18 0M10 55c5-4 10-4 15 0 5-4 10-4 15 0 5-4 9-4 14 0"
        strokeWidth="3"
      />
      <path d="m17 6 2-3m29 3-2-3m-27 38-3 3m30-4 3 3" />
      <path className="hazard-solid" d="m29 38 3 5 3-5Z" />
    </>
  ),
  animal: (
    <>
      <path
        className="hazard-solid"
        d="M16 48c-1-7 6-11 10-17 3-5 9-5 12 0 4 6 11 10 10 17-1 8-10 7-16 4-6 3-15 4-16-4ZM8 28c-4-7-1-14 4-13s10 8 8 13-8 8-12 0Zm15-7c-4-7-2-16 3-16s9 9 8 15-7 9-11 1Zm15-1c-1-8 4-16 9-14s5 11 1 17-9 4-10-3Zm12 9c-1-7 5-14 10-12s4 11 0 16-9 3-10-4ZM9 11 8 3l6 9Zm16-9 2-5 4 6Zm19 0 5-4-1 7Zm14 11 7-6-3 10Z"
      />
      <path className="hazard-cut" d="m25 41 6-6m-9 11 12-7m2 5 5 4" />
      <path d="m17 60 9-5m8 7 9-5" />
    </>
  ),
  rockfall: (
    <>
      <path
        className="hazard-solid"
        d="m9 39 14-9 15 9-5 18H14Zm25-20 15-5 11 13-7 14-18-8ZM13 7l13-4 9 11-9 11-15-6Z"
      />
      <path
        className="hazard-cut"
        d="m16 41 9-5 6 7-4 9m15-31 8 3 5 10M16 11l8-3 5 7"
      />
      <path d="m6 24-3 9m40 12-3 13M34 2l5 9" />
    </>
  ),
  fire: (
    <>
      <path
        className="hazard-solid"
        fillRule="evenodd"
        d="M31 3c9 13-3 18 8 26 4-3 5-8 5-12 16 18 18 33 4 42H17C3 49 8 32 19 23c-2 10 3 13 5 11C17 21 29 17 31 3Zm1 33c-5 9-13 13-5 23h10c9-9 0-16-5-23Z"
      />
      <path d="m6 14 2 6m45-10-3 7" />
    </>
  ),
  storm: (
    <>
      <path
        className="hazard-solid"
        d="M3 22 11 8l12-2 9 7 9-7 15 6 5 12-24 3-8 12 12-3-21 26 5-22-10 1 10-16Z"
      />
      <path className="hazard-cut" d="m12 17 6-5 8 7m13-2 8-4 6 6" />
      <path d="m9 35-5 9m47-10-5 10m9 3-4 8" />
    </>
  ),
};

export default function LevelEmblem({ level, number, className = "" }) {
  const hazard = levelHazard(level || number);
  return (
    <span className={`level-emblem ${className}`} aria-hidden="true">
      <svg viewBox="0 0 72 72" fill="none" focusable="false">
        <path className="emblem-frame" d="M5 3h55l9 9v55H14L3 56V5Z" />
        <path
          className="emblem-score"
          d="m8 11 4-4m48 53 5-5M7 56l9 7M55 7l9 9"
        />
        <g
          transform="translate(7 8) scale(.86)"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="square"
          strokeLinejoin="miter"
        >
          {artwork[hazard.artwork]}
        </g>
      </svg>
    </span>
  );
}
