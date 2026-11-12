import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { models } from "../lib/db.js";
import {
  buildNotifications,
  monitoringRequired,
  claimSignInNotice,
} from "../lib/notifications.js";
import { markNotificationsRead } from "../lib/notification-store.js";
import { snapshot } from "../lib/snapshot.js";
import {
  signToken,
  verifyToken,
  sessionKeyForToken,
} from "../lib/session-token.js";
import { pilotFixture } from "./pilot-fixture.mjs";

const fixture = () => ({
  user: { _id: "self", name: "QA Player", role: "GAMER", drops: 3 },
  roster: [{ _id: "other", name: "Other", drops: 4 }],
  tasks: [],
  events: [],
  rescues: [],
  energy: [],
});

test("monitoring notifications use the affected player, never a teammate's condition", () => {
  const data = fixture();
  assert.equal(monitoringRequired(data), true);
  assert.equal(buildNotifications(data).items.length, 1);
  assert.match(buildNotifications(data).items[0].id, /self/);
  data.user.drops = 0;
  assert.equal(monitoringRequired(data), false);
  assert.equal(buildNotifications(data).items.length, 0);
  data.rescues = [{ _id: "case", userId: "self", status: "OPEN" }];
  assert.equal(monitoringRequired(data), true);
  data.rescues[0].status = "CLOSED";
  assert.equal(monitoringRequired(data), false);
});

test("read status does not resolve monitoring; a later penalty produces a new notification", () => {
  const data = fixture();
  data.energy = [{ _id: "penalty-1", userId: "self", change: -1 }];
  const id = buildNotifications(data).items[0].id;
  const view = buildNotifications(data, [{ notificationId: id }]);
  assert.equal(view.unread, 0);
  assert.equal(view.items[0].requiresAttention, true);
  assert.equal(monitoringRequired(data), true);
  data.energy[0]._id = "penalty-2";
  assert.equal(buildNotifications(data, [{ notificationId: id }]).unread, 1);
});

test("sign-in notices are claimed once per session, and each real sign-in has a fresh identity", () => {
  const saved = new Map();
  const storage = {
    getItem: (key) => saved.get(key),
    setItem: (key, value) => saved.set(key, value),
  };
  const first = signToken("self"),
    second = signToken("self");
  assert.notEqual(first, second);
  assert.equal(verifyToken(first), "self");
  assert.equal(verifyToken(second), "self");
  assert.equal(sessionKeyForToken("invalid"), null);
  const firstId = JSON.parse(Buffer.from(first.split(".")[0], "base64url")).sid;
  const secondId = JSON.parse(
    Buffer.from(second.split(".")[0], "base64url"),
  ).sid;
  assert.equal(sessionKeyForToken(first), firstId);
  assert.equal(sessionKeyForToken(first), sessionKeyForToken(first));
  assert.equal(claimSignInNotice(firstId, storage), true);
  assert.equal(claimSignInNotice(firstId, storage), false);
  assert.equal(claimSignInNotice(secondId, storage), true);
  assert.doesNotThrow(() => claimSignInNotice("blocked-storage", null));
});

test("inbox combines announcements, own assignments, replies and scoped sprint notices without marks", () => {
  const data = fixture();
  data.tasks = [
    {
      _id: "own-task",
      assigneeId: "self",
      title: "My objective",
      status: "Backlog",
    },
    {
      _id: "other-task",
      assigneeId: "other",
      title: "Private task",
      status: "Backlog",
    },
  ];
  data.events = [
    { _id: "dispatch", title: "Client change", description: "New requirement" },
  ];
  data.weekOneProgram = {
    notifications: [
      { id: "rule-1", message: "Read the rules", screen: "game-rules" },
    ],
    tickets: [
      {
        _id: "question",
        userId: "self",
        data: { replies: [{ id: "answer", text: "Your answer" }] },
      },
    ],
    results: [{ privateMark: 99 }],
  };
  const result = buildNotifications(
    data,
    [],
    [
      {
        _id: "sprint-own",
        userId: "self",
        state: "EXPECT_DELAY",
        data: { text: "Check your ETA" },
      },
      {
        _id: "sprint-other",
        userId: "other",
        state: "EXPECT_DELAY",
        data: { text: "Other private notice" },
      },
    ],
  );
  assert.ok(
    result.items.some((row) => row.title === "A reply to your question"),
  );
  assert.ok(result.items.some((row) => row.message === "Check your ETA"));
  assert.doesNotMatch(
    JSON.stringify(result),
    /Private task|Other private notice|privateMark/,
  );
});

test(
  "MongoDB notification read receipts persist, remain private and never clear monitoring",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 120000 },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/notifications_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    try {
      const { gamers, cc, teams } = await pilotFixture(2);
      const gamer = gamers[0],
        teammate = gamers[1],
        outsider = gamers[5];
      await models.User.updateOne({ _id: gamer._id }, { $set: { drops: 3 } });
      const self = await snapshot(gamer);
      const monitor = self.notifications.items.find((item) =>
        item.id.startsWith("monitoring:"),
      );
      assert.ok(monitor);
      await markNotificationsRead(gamer, [monitor.id]);
      await markNotificationsRead(gamer, [monitor.id]);
      assert.equal(
        await models.NotificationReceipt.countDocuments({ userId: gamer._id }),
        1,
      );
      assert.equal(
        (await snapshot(gamer)).notifications.items.find(
          (item) => item.id === monitor.id,
        ).read,
        true,
      );
      assert.equal((await models.User.findById(gamer._id)).drops, 3);
      await assert.rejects(
        markNotificationsRead(teammate, [monitor.id]),
        (error) => error.status === 403,
      );
      assert.equal(
        (await snapshot(teammate)).notifications.items.some(
          (item) => item.id === monitor.id,
        ),
        false,
      );
      await models.PilotNotice.create({
        _id: randomUUID(),
        cohortId: "alpha",
        sprintId: "synthetic",
        teamId: teams[0].id,
        userId: gamer._id,
        state: "EXPECT_DELAY",
        data: { text: "PRIVATE_PLAYER_NOTICE" },
      });
      assert.ok(
        JSON.stringify((await snapshot(gamer)).notifications).includes(
          "PRIVATE_PLAYER_NOTICE",
        ),
      );
      assert.ok(
        !JSON.stringify((await snapshot(teammate)).notifications).includes(
          "PRIVATE_PLAYER_NOTICE",
        ),
      );
      assert.ok(
        !JSON.stringify((await snapshot(outsider)).notifications).includes(
          "PRIVATE_PLAYER_NOTICE",
        ),
      );
      assert.ok(
        (await snapshot(cc)).notifications.items.some((item) =>
          item.id.startsWith("monitoring:"),
        ),
      );
    } finally {
      if (mongoose.connection.readyState) {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
      }
    }
  },
);
