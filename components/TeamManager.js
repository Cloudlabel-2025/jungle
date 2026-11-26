"use client";
import { useRef, useState } from "react";
import { Plus, Users, UserPlus, Trash2, ShieldCheck } from "lucide-react";
import { Panel, Badge, Avatar } from "./ui";
import { fullStackTeamReady } from "@/lib/characters";

import { assignmentSlotFor } from '@/lib/team-slots';

export default function TeamManager({ data, act }) {
  const [editing, setEditing] = useState(false),
    [teamId, setTeamId] = useState(null),
    [name, setName] = useState("");
  const counter = useRef(0);
  const blank = () => ({
    id: ++counter.current,
    name: "",
    username: "",
    password: "",
  });
  const [members, setMembers] = useState([]),
    [busy, setBusy] = useState(false);
  const existing = data.roster.filter((p) => p.teamId === teamId);
  const maximum = teamId ? 5 - existing.length : 5;
  function open(team = null) {
    setTeamId(team?._id || null);
    setName(team?.name || "");
    setMembers([blank()]);
    setEditing(true);
  }
  function update(id, key, value) {
    setMembers((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  }
  function add() {
    if (members.length < maximum)
      setMembers((rows) => [...rows, blank()]);
  }
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await act(
        `centre-command/teams/${teamId ? "add-members" : "create"}`,
        {
          ...(teamId ? { teamId } : { name }),
          members: members.map(({ id, ...member }) => member),
        },
        teamId
          ? "Player accounts added to the team."
          : "Team and player accounts created. Members can sign in with username and password.",
      );
      if (result) {
        setMembers([]);
        setName("");
        setEditing(false);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title="Teams & explorers"
      kicker="CENTRE COMMAND · BUILD YOUR PARTIES"
      action={
        <button className="btn primary" onClick={() => open()} disabled={busy}>
          <Plus size={16} />
          Create team
        </button>
      }
    >
      <p className="detail-copy">
        Create a party with up to five members. Each member gets a username,
        password. Work roles begin in the jungle coding stage and rotate with each sprint. Each player creates their own personal avatar.
      </p>
      {editing && (
        <form
          method="post"
          className="field-form team-create-form"
          onSubmit={save}
          aria-busy={busy}
        >
          <div className="team-create-heading">
            <Users size={20} />
            <h3>{teamId ? `Add members to ${name}` : "Assemble a new team"}</h3>
            <Badge>
              {members.length + (teamId ? existing.length : 0)}/5 MEMBERS
            </Badge>
          </div>
          {!teamId && (
            <label>
              Team name
              <input
                required
                minLength={3}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              />
            </label>
          )}
          <p className="support-copy">
            Roles are assigned automatically after flight clearance. Players choose their own appearance. Teams with fewer than five members can sign in and
            explore, and show as forming until ready for five-feature levels.
          </p>
          <div className="team-member-forms">
            {members.map((member, index) => {
              return (
                <fieldset key={member.id} disabled={busy}>
                  <legend>EXPLORER {String(index + 1).padStart(2, "0")}</legend>
                  <div className="team-member-preview">
                    <Avatar
                      player={{
                        name: member.name,
                      }}
                    />
                    <span>
                      <strong>
                        {member.name || `Player ${index + 1}`}
                      </strong>
                      <small>
                        Personal avatar created by the player
                      </small>
                    </span>
                    {members.length > 1 && (
                      <button
                        className="icon-btn"
                        type="button"
                        aria-label={`Remove member ${index + 1}`}
                        onClick={() =>
                          setMembers((rows) =>
                            rows.filter((m) => m.id !== member.id),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="team-member-fields">
                    <label>
                      Full name
                      <input
                        required
                        minLength={2}
                        maxLength={80}
                        autoComplete="off"
                        value={member.name}
                        onChange={(e) =>
                          update(member.id, "name", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Username
                      <input
                        required
                        minLength={3}
                        maxLength={32}
                        pattern="[A-Za-z0-9][A-Za-z0-9_.-]{2,31}"
                        autoCapitalize="none"
                        spellCheck={false}
                        autoComplete="off"
                        value={member.username}
                        onChange={(e) =>
                          update(member.id, "username", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Initial password
                      <input
                        required
                        type="password"
                        minLength={8}
                        maxLength={256}
                        autoComplete="new-password"
                        value={member.password}
                        onChange={(e) =>
                          update(member.id, "password", e.target.value)
                        }
                      />
                      <small>
                        8–256 characters. Members sign in with their username.
                      </small>
                    </label>
                  </div>
                  <p className="team-ability-preview"><ShieldCheck size={14} />
                    Your work role rotates each sprint. Your avatar stays yours.
                  </p>
                </fieldset>
              );
            })}
          </div>
          <div className="button-row">
            <button
              className="btn"
              type="button"
              disabled={busy || members.length >= maximum}
              onClick={add}
            >
              <UserPlus size={16} />
              Add member ({members.length + (teamId ? existing.length : 0)}/5)
            </button>
            <button className="btn primary" disabled={busy}>
              {busy
                ? "Creating accounts…"
                : teamId
                  ? "Add members & accounts"
                  : "Create team & accounts"}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                setMembers([]);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="managed-team-list">
        {data.teams.map((team) => {
          const players = data.roster.filter((p) => p.teamId === team._id);
          return (
            <article key={team._id}>
              <header>
                <div>
                  <small>{team.code}</small>
                  <h3>{team.name}</h3>
                </div>
                <Badge>
                  {players.length}/5 ·{" "}
                  {fullStackTeamReady(data.roster, team._id)
                    ? "READY"
                    : "FORMING"}
                </Badge>
              </header>
              <div className="managed-team-members">
                {players.map((player) => (
                  <div key={player._id}>
                    <Avatar player={player} />
                    <span>
                      <strong>{player.name}</strong>
                      <small>
                        {player.username
                          ? `@${player.username}`
                          : "Existing account"}{" "}
                        · {assignmentSlotFor(player)?.label || "Explorer"}
                      </small>
                      <small>{player.avatar ? "Personal avatar" : "Avatar not created yet"}</small>
                    </span>
                  </div>
                ))}
              </div>
              {players.length < 5 && (
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => open(team)}
                >
                  <UserPlus size={15} />
                  Add members
                </button>
              )}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
