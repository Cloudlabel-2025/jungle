"use client";
import { useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, AlertTriangle } from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import ExpeditionHeading from "./ExpeditionHeading";

export default function NotificationInbox() {
  const { data, act } = useWorkspace();
  const [category, setCategory] = useState("All");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const items = data.notifications?.items || [];
  const unread = items.filter((item) => !item.read);
  const visible = items.filter(
    (item) =>
      (category === "All" || category === item.category) &&
      (!unreadOnly || !item.read),
  );
  async function mark(ids) {
    if (!ids.length || saving) return;
    setSaving(true);
    try {
      await act("notifications/read", { ids }, null);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="notification-inbox" aria-label="Notification inbox">
      <ExpeditionHeading
        code="N1"
        title="Notifications"
        subtitle="Your expedition updates, support follow-ups and programme notices, together."
      />
      <div className="notification-toolbar">
        <span>
          <Bell size={18} /> <strong>{unread.length} unread</strong> · Latest{" "}
          {items.length} updates
        </span>
        <button
          className="btn small"
          onClick={() => mark(unread.map((item) => item.id))}
          disabled={!unread.length || saving}
        >
          <CheckCheck size={16} /> Mark all as read
        </button>
        <label>
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option>All</option>
            {[...new Set(items.map((item) => item.category))]
              .sort()
              .map((name) => (
                <option key={name}>{name}</option>
              ))}
          </select>
        </label>
        <label className="notification-unread-filter">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
          />{" "}
          Unread only
        </label>
      </div>
      <p className="notification-help">
        Reading an update does not acknowledge an agenda, approve work, or
        resolve a monitoring or recovery case. Complete the required action on
        its linked page.
      </p>
      <div className="notification-list">
        {visible.map((item) => (
          <article
            key={item.id}
            className={`notification-card ${item.read ? "is-read" : "is-unread"}`}
          >
            <div className="notification-symbol">
              {item.requiresAttention ? (
                <AlertTriangle size={21} />
              ) : (
                <Bell size={21} />
              )}
            </div>
            <div className="notification-content">
              <div className="notification-meta">
                <span>{item.category}</span>
                {!item.read && <strong>Unread</strong>}
                {item.requiresAttention && <span>Needs attention</span>}
                {item.createdAt && (
                  <time dateTime={new Date(item.createdAt).toISOString()}>
                    {new Date(item.createdAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    IST
                  </time>
                )}
              </div>
              <h2>{item.title}</h2>
              <p>{item.message}</p>
              <div className="button-row">
                <Link
                  href={item.href}
                  className="btn small"
                  onClick={() => {
                    if (!item.read) void mark([item.id]);
                  }}
                >
                  Open details
                </Link>
                {!item.read && (
                  <button
                    className="btn small"
                    disabled={saving}
                    onClick={() => mark([item.id])}
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
        {!visible.length && (
          <div className="notification-empty">
            <Bell size={30} />
            <h2>
              {items.length
                ? "You're caught up on this view"
                : "No notifications yet"}
            </h2>
            <p>
              {items.length
                ? "Try another category or show all updates."
                : "Support alerts, announcements, task updates and replies will appear here."}
            </p>
            {items.length > 0 && (
              <button
                className="btn"
                onClick={() => {
                  setCategory("All");
                  setUnreadOnly(false);
                }}
              >
                Show all updates
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
