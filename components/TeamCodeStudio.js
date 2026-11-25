"use client";
import { useState } from "react";
import { setActiveCollege } from "@/lib/college-fetch.js";
import TeamCodeLab from "./TeamCodeLab.js";
import StaffTeamLab from "./StaffTeamLab.js";
import { prefix } from "@/lib/catalog.js";
export default function TeamCodeStudio({ user }) {
  setActiveCollege(user.collegeId);
  const [notice, setNotice] = useState(null);
  return (
    <div className="team-studio-page">
      <div className="team-studio-top">
        <a href={`/${prefix(user.role)}/ide`}>← Return to your expedition</a>
        <span>{user.name} · Coding studio</span>
      </div>
      {notice && (
        <div
          className="team-studio-notice"
          role={notice.type === "error" ? "alert" : "status"}
        >
          {notice.message}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}
      {user.role === "GAMER" ? (
        <TeamCodeLab
          data={{ user }}
          studio
          notify={(message, type) => setNotice({ message, type })}
        />
      ) : (
        <StaffTeamLab
          notify={(message, type) => setNotice({ message, type })}
        />
      )}
    </div>
  );
}
