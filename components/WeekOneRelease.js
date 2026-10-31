"use client";

import { Panel, Badge, Form } from "./ui";

export default function WeekOneRelease({ data, act, now }) {
  const release = data.weekOne;
  if (!release || data.user.role === "GAMER") return null;
  const current = release.days.find((d) => d.state === "OPEN");
  const next = release.days.find((d) => d.state !== "CLOSED");
  const run = (action, day, values = {}) =>
    act(`week1/${action}`, {
      ...values,
      day,
      revision: release.revision,
    });
  return (
    <Panel title="Week 1 day release" kicker="MC / CC CONTROL">
      <p className="muted">
        Prepare each day, then open it here. Close the current day after its
        scheduled activities end. Assessment reviews can remain pending.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Status</th>
              <th>Content version</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {release.days.map((day) => (
              <tr key={day.day}>
                <td>
                  Day {day.day} · {day.title}
                </td>
                <td>
                  <Badge>{day.state}</Badge>
                </td>
                <td>{day.contentVersion || "Not prepared"}</td>
                <td>
                  {day.state === "PREPARED" && (
                    <button
                      className="btn small primary"
                      disabled={Boolean(current) || next?.day !== day.day}
                      onClick={() => run("open", day.day)}
                    >
                      Open Day {day.day}
                    </button>
                  )}
                  {day.state === "OPEN" && (
                    <button
                      className="btn small"
                      disabled={new Date(now) < new Date(day.scheduledEnd)}
                      onClick={() => run("close", day.day)}
                    >
                      Close Day {day.day}
                    </button>
                  )}
                  {day.state === "DRAFT" && (
                    <span className="muted">Content preparation required</span>
                  )}
                  {day.state === "CLOSED" && (
                    <span className="muted">Read-only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {current && !current.agenda && (
        <Form
          key={`agenda-${current.day}`}
          fields={[
            {
              name: "text",
              label: `Day ${current.day} agenda`,
              type: "textarea",
              min: 10,
            },
          ]}
          submit="Publish agenda to Announcements"
          onSubmit={(values) => run("publish-agenda", current.day, values)}
        />
      )}
      {current?.agenda && (
        <p className="muted">
          Today's agenda is published. Learners find it independently.
        </p>
      )}
      {release.events?.length > 0 && (
        <details>
          <summary>Day release history</summary>
          {release.events.map((event) => (
            <p key={event._id} className="muted">
              Day {event.details.day} · {event.kind} · {event.actorId} ·{" "}
              {new Date(event.createdAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}
              {event.details.contentVersion
                ? ` · Content v${event.details.contentVersion}`
                : ""}
            </p>
          ))}
        </details>
      )}
    </Panel>
  );
}
