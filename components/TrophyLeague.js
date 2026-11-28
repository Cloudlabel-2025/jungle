"use client";
import { useEffect, useRef, useState } from "react";
import RewardOverlay from "./RewardOverlay";
import {
  Trophy,
  Compass,
  Flame,
  Shield,
  Crown,
  Mountain,
  ChevronUp,
  ChevronDown,
  Check,
  LockKeyhole,
  Star,
  Wheat,
} from "lucide-react";
import {
  TROPHY_LEAGUES,
  trophyLeague,
  trackTrophyLeague,
  LEAGUE_CELEBRATION_MS,
} from "@/lib/trophy-leagues.js";
import { collegeStorageKey } from "@/lib/college-fetch.js";
import Link from "next/link";
import TrophyConductRules from "./TrophyConductRules";

const icons = [Compass, Flame, Shield, Mountain, Crown, Trophy];
export function LeagueEmblem({ league, small = false }) {
  if (league.id === "unranked")
    return (
      <span
        className={`league-unranked-mark ${small ? "is-small" : ""}`}
        aria-hidden="true"
      >
        <Trophy strokeWidth={1.5} />
      </span>
    );
  const tier =
    league.index ?? TROPHY_LEAGUES.findIndex((l) => l.id === league.id);
  const Icon =
    icons[
      league.index ?? TROPHY_LEAGUES.findIndex((l) => l.id === league.id)
    ] || Compass;
  return (
    <span
      className={`league-emblem medal-${league.id} ${small ? "is-small" : ""}`}
      style={{ "--league-color": league.color }}
      aria-hidden="true"
    >
      <span className="medal-ribbons">
        <i />
        <i />
      </span>
      {tier >= 2 && (
        <span className="medal-laurels">
          <Wheat />
          <Wheat />
        </span>
      )}
      <span className="medal-rim">
        <span className="medal-face">
          <Icon className="medal-symbol" strokeWidth={2.3} />
          <span className="medal-stars">
            {Array.from(
              { length: league.division?.number || 1 },
              (_, index) => (
                <Star key={index} />
              ),
            )}
          </span>
        </span>
      </span>
      {tier >= 4 && <Crown className="medal-crown" strokeWidth={1.8} />}
      {league.division && (
        <span className="medal-division">{league.division.label}</span>
      )}
    </span>
  );
}
export function LeagueBadge({ trophies, onClick }) {
  const league = trophyLeague(trophies);
  const content = (
    <>
      <LeagueEmblem league={league} small />
      <span>
        <strong>{league.displayName}</strong>
        <small>
          <Trophy size={11} /> {league.total} trophies
        </small>
      </span>
    </>
  );
  return onClick ? (
    <button
      className="league-hud"
      onClick={onClick}
      aria-label={`Open trophy leagues. ${league.displayName}, ${league.total} trophies`}
    >
      {content}
    </button>
  ) : (
    <span className="league-hud">{content}</span>
  );
}
export default function TrophyLeague({ trophies = 0, compact = false }) {
  const league = trophyLeague(trophies);
  return (
    <section
      className={`trophy-league ${compact ? "is-compact" : ""}`}
      aria-label="Your trophy league"
      style={{ "--league-color": league.color }}
    >
      <div className="league-feature">
        <LeagueEmblem league={league} />
        <div>
          <span className="league-hall-label">
            {league.ranked ? "Your earned league" : "No league earned yet"}
          </span>
          <h2>{league.displayName}</h2>
          <p>{league.motto}</p>
        </div>
        <strong className="league-total">
          <Trophy size={18} />
          {league.total}
          <small>total trophies</small>
        </strong>
      </div>
      {league.ranked && (
        <ol
          className="league-divisions"
          aria-label={`${league.name} divisions`}
        >
          {league.divisions.map((floor, index) => (
            <li
              key={floor}
              className={
                index + 1 === league.division.number
                  ? "is-current"
                  : index + 1 < league.division.number
                    ? "is-earned"
                    : ""
              }
              aria-current={
                index + 1 === league.division.number ? "step" : undefined
              }
            >
              <span>Division {["I", "II", "III"][index]}</span>
              <strong>{floor.toLocaleString()}+</strong>
              {index + 1 === league.division.number && (
                <small>YOU ARE HERE</small>
              )}
            </li>
          ))}
        </ol>
      )}
      <div className="league-progress-copy">
        <strong>
          {league.nextRank
            ? `${league.rankRemaining} ${league.rankRemaining === 1 ? "trophy" : "trophies"} to ${league.nextRank.name}`
            : "Legend III · Highest division reached"}
        </strong>
        <span>
          {league.nextRank
            ? `${league.total} / ${league.nextRank.floor}`
            : `${league.total} trophies`}
        </span>
      </div>
      <div
        className="league-progress"
        role="progressbar"
        aria-label="Progress to next league division"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(league.rankPercent)}
        aria-valuetext={
          league.nextRank
            ? `${league.rankRemaining} ${league.rankRemaining === 1 ? "trophy" : "trophies"} to ${league.nextRank.name}`
            : "Highest division reached"
        }
      >
        <i style={{ width: `${league.rankPercent}%` }} />
      </div>
      <p className="league-retention">
        {league.ranked
          ? `Your current division starts at ${league.rankFloor.toLocaleString()} trophies. Only a reviewed result correction or invalid reward reversal can lower your trophy balance and division.`
          : `Earn ${league.next.floor} trophies to enter ${league.next.name}. Until then, you remain unranked and receive no league badge.`}
      </p>
      {!compact && (
        <>
          <ol className="league-trail" aria-label="Trophy league ladder">
            {TROPHY_LEAGUES.map((tier, index) => (
              <li
                key={tier.id}
                className={
                  index === league.index
                    ? "is-current"
                    : index < league.index
                      ? "is-passed"
                      : "is-locked"
                }
                style={{ "--league-color": tier.color }}
                aria-current={index === league.index ? "step" : undefined}
              >
                <LeagueEmblem
                  league={{
                    ...tier,
                    index,
                    division: index === league.index ? league.division : null,
                  }}
                  small
                />
                <strong>{tier.name}</strong>
                <span>{tier.floor.toLocaleString()}+</span>
                <small>
                  {index === league.index ? (
                    `DIVISION ${league.division.label}`
                  ) : index < league.index ? (
                    <Check size={12} />
                  ) : (
                    <LockKeyhole size={12} />
                  )}
                </small>
              </li>
            ))}
          </ol>
          <details className="game-rule-disclosure">
            <summary>How promotion and demotion work</summary>
            <p>
              Earn trophies from completed missions and approved work to advance
              through Division I, II and III, then enter the next league. Your
              league and division follow your current total trophy balance
              immediately. If a result is corrected or a reward is revoked, a
              lower balance can move you down. Trophies are not spent on
              starting missions, and normal gameplay does not spend energy. There is no seasonal
              reset or daily decay. XP levels and staff-published assessment
              marks remain separate.
            </p>
          </details>
          <TrophyConductRules />
          <Link className="btn" href="/gamer/week-one-ask-mc">
            Ask about a result correction
          </Link>
        </>
      )}
    </section>
  );
}
export function TrophyLeagueChange({ player, ready = true }) {
  const previous = useRef(undefined),
    [change, setChange] = useState(null);
  useEffect(() => {
    const key = collegeStorageKey(`vow:trophy-league:v1:${player._id}`);
    if (previous.current === undefined) {
      try {
        previous.current = JSON.parse(localStorage.getItem(key));
      } catch {
        previous.current = null;
      }
    }
    const state = trackTrophyLeague(previous.current, player.trophies);
    previous.current = state;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* Balance-derived rank still works without storage. */
    }
    setChange(state.pending);
  }, [player._id, player.trophies]);
  const close = () => {
    previous.current = { ...previous.current, pending: null };
    try { localStorage.setItem(collegeStorageKey(`vow:trophy-league:v1:${player._id}`), JSON.stringify(previous.current)); } catch {}
    setChange(null);
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!ready || !change) return;
    const timer = setTimeout(() => closeRef.current(), LEAGUE_CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [change, ready]);
  if (!change || !ready) return null;
  return <LeagueTransition key={`${change.direction}:${change.to}`} change={change} />;
}
export function LeagueTransition({ change }) {
  const Icon = change.direction === "promotion" ? ChevronUp : ChevronDown;
  return (
    <RewardOverlay title={change.direction === "promotion" ? `Promoted to ${change.to}` : `League demotion: ${change.to}`} duration={LEAGUE_CELEBRATION_MS}>
    <section
      className={`league-celebration is-${change.direction}`}
    >
      <div className="league-celebration-art" aria-hidden="true"><span className="league-celebration-orbit" />
        <LeagueEmblem league={change.league} />
        <span className="league-celebration-direction"><Icon size={28}/></span>
      </div>
      <div className="league-celebration-copy">
        <span className="league-celebration-label">
          {change.direction === "promotion"
            ? "LEAGUE PROMOTION"
            : "LEAGUE DEMOTION"}
        </span>
        <h2>
          {change.direction === "promotion"
            ? `Promoted to ${change.to}`
            : change.league.ranked
              ? `Now in ${change.to} league`
              : "Returned to unranked"}
        </h2>
        <p className="league-celebration-path">{change.from} <span aria-hidden="true">→</span> {change.to}</p>
        <p className="league-celebration-total"><Trophy size={17} aria-hidden="true"/> {change.total} trophies</p>
      </div>
    </section>
    </RewardOverlay>
  );
}
