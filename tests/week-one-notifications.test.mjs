import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
import { deliverCollegeNotices } from "../lib/week-one-notifications.js";

test(
  "college notifications queue without configuration, require approved contacts and deliver idempotently with retry",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/week1_notices_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    const keys = [
        "WEEK1_NOTIFICATION_WEBHOOK_URL",
        "WEEK1_NOTIFICATION_WEBHOOK_TOKEN",
        "WEEK1_COLLEGE_CONTACTS_JSON",
      ],
      saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    const cc = { _id: "cc", role: "CENTRE_COMMAND", cohortId: "alpha" };
    await connect();
    for (const model of Object.values(models)) await model.init();
    try {
      for (const key of keys) delete process.env[key];
      const result = {
          userId: "g",
          name: "Test learner",
          total: 60,
          parts: { fitness: 20 },
        },
        booking = {
          userId: "g",
          status: "BOOKED",
          start: "2026-11-07T03:30:00Z",
          end: "2026-11-07T04:30:00Z",
          meetingUrl: "https://meet.example/rescue",
        };
      await models.WeekOneProgram.create({
        _id: "alpha",
        version: 1,
        data: {
          publications: [{ version: 1, results: [result], rescue: [booking] }],
        },
      });
      let calls = 0;
      const mockFetch = async (url, options) => {
        calls++;
        assert.equal(url, "https://notice.example/approved");
        assert.equal(options.headers["Idempotency-Key"], "alpha:1:g");
        const payload = JSON.parse(options.body);
        assert.equal(payload.recipients[0].email, "college@example.invalid");
        assert.equal(payload.booking.meetingUrl, booking.meetingUrl);
        assert.equal(payload.learner.name, "Test learner");
        assert.equal(payload.learner.total, undefined);
        assert.ok(!options.body.includes('"parts"'));
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { ok: true, status: 200 };
      };
      assert.equal(
        (await deliverCollegeNotices(cc, { fetchImpl: mockFetch })).pending,
        1,
      );
      assert.equal(calls, 0);
      assert.equal(
        (await models.WeekOneDelivery.findById("alpha:1:g")).status,
        "CONFIGURATION_REQUIRED",
      );
      await assert.rejects(
        deliverCollegeNotices(
          { ...cc, role: "GAMER" },
          { fetchImpl: mockFetch },
        ),
        (e) => e.status === 403,
      );
      process.env.WEEK1_NOTIFICATION_WEBHOOK_URL =
        "https://notice.example/approved";
      process.env.WEEK1_COLLEGE_CONTACTS_JSON = JSON.stringify({
        alpha: [{ name: "College contact", email: "college@example.invalid" }],
      });
      assert.equal(
        (await deliverCollegeNotices(cc, { fetchImpl: mockFetch })).pending,
        1,
      );
      assert.equal(calls, 0);
      process.env.WEEK1_COLLEGE_CONTACTS_JSON = JSON.stringify({
        alpha: [
          {
            name: "College contact",
            email: "college@example.invalid",
            approval:
              "Fixture institution authorised this scheduling recipient.",
          },
        ],
      });
      await Promise.all(
        Array.from({ length: 5 }, () =>
          deliverCollegeNotices(cc, { fetchImpl: mockFetch }),
        ),
      );
      assert.equal(calls, 1);
      assert.equal(
        (await models.WeekOneDelivery.findById("alpha:1:g")).status,
        "SENT",
      );
      await deliverCollegeNotices(cc, { fetchImpl: mockFetch });
      assert.equal(calls, 1);
      await models.WeekOneProgram.updateOne(
        { _id: "alpha" },
        {
          $push: {
            "data.publications": {
              version: 2,
              results: [result],
              rescue: [booking],
            },
          },
        },
      );
      await deliverCollegeNotices(cc, {
        fetchImpl: async () => ({ ok: false, status: 503 }),
      });
      assert.equal(
        (await models.WeekOneDelivery.findById("alpha:2:g")).status,
        "DELIVERY_FAILED",
      );
      await deliverCollegeNotices(cc, {
        fetchImpl: async (_url, options) => {
          assert.equal(options.headers["Idempotency-Key"], "alpha:2:g");
          return { ok: true, status: 200 };
        },
      });
      const delivered =
        await models.WeekOneDelivery.findById("alpha:2:g").lean();
      assert.equal(delivered.status, "SENT");
      assert.equal(delivered.attempts, 2);
      assert.equal(
        (await models.WeekOneEvent.find({ kind: "COLLEGE_NOTICE_DELIVERED" }))
          .length,
        2,
      );
      assert.deepEqual(
        await deliverCollegeNotices(
          { ...cc, cohortId: "other" },
          { fetchImpl: mockFetch },
        ),
        { delivered: 0, pending: 0 },
      );
    } finally {
      for (const key of keys) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      }
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
