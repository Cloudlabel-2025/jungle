"use client";
import { useId } from "react";

export default function MissionStars({ stars, size = "map" }) {
  const id = useId().replaceAll(":", "");
  return (
    <span
      className={`sky-station-stars${size === "result" ? " mission-stars-result" : ""}`}
      role="img"
      aria-label={`${stars} of 3 stars earned`}
    >
      {[1, 2, 3].map((star) => (
        <span
          key={`${star}-${star <= stars}`}
          className={`sky-reward-star ${star <= stars ? "is-earned" : ""}`}
          style={{ "--star-index": star }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 48 48" width="40" height="40">
            <defs>
              <linearGradient
                id={`${id}-gold-${star}`}
                x1="0"
                y1="0"
                x2="0.4"
                y2="1"
              >
                <stop offset="0" stopColor="#fff6bd" />
                <stop offset="0.42" stopColor="#ffd768" />
                <stop offset="1" stopColor="#dc8a20" />
              </linearGradient>
            </defs>
            <path
              className="sky-star-depth"
              d="m24 3 6.4 13 14.3 2.1-10.3 10.1 2.4 14.2L24 35.7l-12.8 6.7 2.4-14.2L3.3 18.1 17.6 16Z"
              transform="translate(0 2)"
            />
            <path
              className="sky-star-face"
              d="m24 3 6.4 13 14.3 2.1-10.3 10.1 2.4 14.2L24 35.7l-12.8 6.7 2.4-14.2L3.3 18.1 17.6 16Z"
              style={
                star <= stars ? { fill: `url(#${id}-gold-${star})` } : undefined
              }
              strokeLinejoin="round"
            />
            <path
              className="sky-star-facet"
              d="M24 3v21L3.3 18.1 17.6 16Zm0 21 12.8 18.4-2.4-14.2 10.3-10.1Z"
            />
            {star <= stars && (
              <path
                className="sky-star-glint"
                d="m11 19 9-1 4-9"
                fill="none"
                stroke="#fff9d4"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
          </svg>
          {star <= stars && (
            <>
              <i className="sky-star-spark spark-one" />
              <i className="sky-star-spark spark-two" />
            </>
          )}
        </span>
      ))}
    </span>
  );
}
