import { Heart, Zap } from "lucide-react";
import { MAX_LIVES, MAX_ENERGY, playerBalance } from "@/lib/rules.js";

// All current-balance displays read the account's hp/energy, never programme
// defaults or an old ledger entry. Programme trophies remain independent.
export default function PlayerVitals({ player }) {
  const { hp, energy } = playerBalance(player);
  return (
    <div className="player-vitals" aria-label="Current player balance">
      <span className="life-counter" aria-label={`${hp} of ${MAX_LIVES} lives`}>
        <span>Life</span>
        {Array.from({ length: MAX_LIVES }, (_, i) => (
          <Heart
            aria-hidden="true"
            size={13}
            key={i}
            className={i < hp ? "vital-filled" : "vital-empty"}
          />
        ))}
        <small>
          {hp}/{MAX_LIVES}
        </small>
      </span>
      <span
        className="energy-counter"
        aria-label={`${energy} of ${MAX_ENERGY} energy`}
        title="Your current balance is shared across the expedition, Week 1, recovery and sprints."
      >
        <span>Energy</span>
        {Array.from({ length: MAX_ENERGY }, (_, i) => (
          <Zap
            aria-hidden="true"
            size={13}
            key={i}
            className={i < energy ? "vital-filled" : "vital-empty"}
          />
        ))}
        <small>
          {energy}/{MAX_ENERGY}
        </small>
      </span>
    </div>
  );
}
