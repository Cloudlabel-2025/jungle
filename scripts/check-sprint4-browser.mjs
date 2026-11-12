import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { models } from "../lib/db.js";
import { hashPassword } from "../lib/password.js";
import { pilotAction } from "../lib/pilot-engine.js";
import { pilotFixture, sprintConfig } from "../tests/pilot-fixture.mjs";
import frozen from "../lib/pilot-part-b.json" with { type: "json" };

const [playwrightRoot, chromePath, evidenceRoot, ...modes] = process.argv.slice(2);
const checkGuides = modes.includes("--guides");
const checkBoard = modes.includes("--board");
assert.ok(playwrightRoot && chromePath && evidenceRoot, "Provide Playwright bundle, Chrome executable and evidence directory.");
const { chromium } = createRequire(resolve(playwrightRoot, "package.json"))("playwright");
const output = resolve(evidenceRoot);
await mkdir(output, { recursive: true });
const base = "http://localhost:3187";
const replica = await MongoMemoryReplSet.create({ binary: { version: "7.0.24" }, replSet: { count: 1 } });
const env = {
  PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, USERPROFILE: process.env.USERPROFILE,
  TEMP: process.env.TEMP, TMP: process.env.TMP, APPDATA: process.env.APPDATA, LOCALAPPDATA: process.env.LOCALAPPDATA,
  MONGODB_URI: replica.getUri("sprint4_browser_matrix"),
  SESSION_SECRET: randomBytes(48).toString("hex"), APP_ORIGIN: base, DEMO_MODE: "false",
  BLOB_READ_WRITE_TOKEN: "", WEEK1_NOTIFICATION_WEBHOOK_URL: "", WEEK1_NOTIFICATION_WEBHOOK_TOKEN: "",
  NEXT_TELEMETRY_DISABLED: "1",
};
process.env.MONGODB_URI = env.MONGODB_URI;
const results = [];
let server, browser;
try {
  const { cc, mc, gamers, teams, cohortId } = await pilotFixture(1);
  const [team] = teams;
  const password = randomBytes(16).toString("hex");
  const now = new Date();
  const kickoff = new Date(+now - 86400000);
  const deadline = new Date(+now + 6 * 86400000);
  const template = frozen.sprints.find(s => s.number === 4);
  const config = {
    ...sprintConfig(teams, mc, 2), number: 4, template,
    kickoffStart: kickoff.toISOString(), kickoffEnd: kickoff.toISOString(), dueAt: deadline.toISOString(),
    contentApproval: "Fictional browser QA fixture approval only.",
  };
  config.teams[0].owners = Object.fromEntries(template.tasks.map(t => [t.id, gamers["ABCDE".indexOf(t.owner)]._id]));
  config.resources = Object.fromEntries(template.tasks.map(t => [t.id, {
    author: "CURRICULUM", url: `https://example.invalid/basic/${t.id}`, version: "Synthetic browser fixture",
    approval: "Fictional browser QA fixture approval only.",
  }]));
  await models.PilotSprint.create({
    _id: "s4-browser-sequence", cohortId, state: "CLOSED", version: 1,
    createdAt: kickoff, data: { number: 3, teams: [], acceptances: [], gates: [] },
  });
  const action = (actor, name, payload = {}) => pilotAction(actor, name, {
    ...payload, requestId: randomUUID(), reason: "Isolated fictional browser verification.",
  }, now);
  await action(cc, "draft", { config });
  await action(cc, "approve");
  await action(cc, "load");
  await action(mc, "kickoff", { teamId: team.id, evidence: "Synthetic browser verification kickoff." });
  if (checkGuides) {
    await action(cc, "settings", {
      policyVersion: "browser-guides-fixture", assistance: { GUIDE: 1, AI_PROMPT: 1, MC_ONE_TO_ONE: 1 },
    });
    for (const index of [0, 1, 4])
      await action(cc, "help-grant", { teamId: team.id, userId: gamers[index]._id, amount: index === 0 ? 6 : 3 });
  }
  const picks = [["QA-13", 27], ["OP-15", 29], ["QA-15", 31], ["UAT-01", 33]];
  // Fixture stage only: prerequisite and schedule guards have separate executed tests.
  await models.PilotTask.updateMany({ cohortId, "data.code": { $in: picks.map(([code]) => code) } }, { $set: { state: "Working" } });
  for (const gamer of gamers) {
    await models.Credential.create({ _id: gamer._id, passwordHash: await hashPassword(password) });
  }
  server = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "3187"], {
    env, stdio: "inherit", windowsHide: true,
  });
  for (let i = 0; ; i++) {
    assert.ok(i < 60 && server.exitCode === null, "Isolated server did not become ready");
    const ready = await fetch(base + "/api/health").then(r => r.ok, () => false);
    if (ready) break;
    await delay(350);
  }
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
  for (const [code, helpId] of picks) {
    const definition = template.tasks.find(t => t.id === code);
    const gamer = gamers["ABCDE".indexOf(definition.owner)];
    const width = checkBoard && code === "UAT-01" ? 320 : 1440;
    const context = await browser.newContext({ viewport: { width, height: 980 } });
    try {
      const page = await context.newPage();
      await page.goto(base + "/api/health");
      const login = await page.evaluate(async (data) => (await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      })).status, { username: gamer.email, password });
      assert.equal(login, 200, "Fictional browser login failed");
      const sprint = base + "/gamer/sprint-board";
      await page.goto(sprint);
      assert.equal(new URL(page.url()).pathname, "/gamer/sprint-board", "Browser did not retain the fictional session");
      const state = await page.evaluate(async () => {
        const response = await fetch("/api/pilot");
        return { status: response.status, tasks: (await response.json()).tasks || [] };
      });
      assert.equal(state.status, 200, "Isolated programme state unavailable");
      assert.ok(state.tasks.some(task => task.data.code === code), "Expected card missing from role snapshot");
      const cardButton = page.locator("button.quest-card").filter({
        has: page.getByText(`${code} · ${definition.title}`, { exact: true }),
      });
      let boardChecked = false;
      const openCard = async () => {
        await page.getByRole("button", { name: "Programme Sprint Work" }).click();
        if (checkBoard && !boardChecked) {
          await cardButton.waitFor();
          const board = page.locator(".pilot-kanban");
          assert.ok(await board.evaluate(el => el.scrollWidth <= el.clientWidth + 1), "Board overflowed horizontally");
          const filter = page.locator(".pilot-board-filter select");
          await filter.selectOption("Accepted");
          assert.equal(await cardButton.count(), 0);
          await filter.selectOption("Working");
          assert.equal(await cardButton.count(), 1);
          await filter.selectOption("");
          await board.scrollIntoViewIfNeeded();
          await page.screenshot({ path: resolve(output, `board-${code}-${width}.png`) });
          await cardButton.focus();
          await page.keyboard.press("Enter");
          await page.getByRole("dialog").waitFor();
          await page.keyboard.press("Escape");
          assert.ok(await cardButton.evaluate(el => el === document.activeElement));
          boardChecked = true;
        }
        await cardButton.click({ timeout: 15000 }).catch(async error => {
          await page.screenshot({ path: resolve(output, "board-diagnostic.png") });
          throw new Error(`Card ${code} did not render on ${new URL(page.url()).pathname}`, { cause: error });
        });
        const dialog = page.getByRole("dialog");
        await dialog.waitFor({ timeout: 8000 });
        assert.ok((await dialog.innerText()).includes(definition.instructions), `Frozen instructions missing on ${code}`);
        return dialog;
      };
      let dialog = await openCard();
      const screenshot = `${helpId}-${code}-task.png`;
      if (checkGuides) {
        const key = ({ "QA-13": "functional", "OP-15": "nonFunctional", "QA-15": "system", "UAT-01": "uat" })[code];
        const guide = frozen.sprint4Help[key];
        const taskId = state.tasks.find(task => task.data.code === code)._id;
        const otherTask = state.tasks.find(task => task.userId !== gamer._id && task.teamId === team.id);
        if (otherTask) {
          const forbidden = await page.evaluate(async ({ id, teamId }) => (await fetch("/api/pilot", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "help", requestId: crypto.randomUUID(), teamId, taskId: id, category: "COGNITION",
              package: "MC_ONE_TO_ONE", reason: "Fictional negative test for unassigned task help.",
            }),
          })).status, { id: otherTask._id, teamId: team.id });
          assert.equal(forbidden, 403);
          assert.equal(await models.HelpTicket.countDocuments({ createdBy: gamer._id, taskId: otherTask._id }), 0);
        }
        const section = dialog.getByRole("region", { name: "Task-specific Sprint 4 help" });
        const choices = section.getByLabel("Task help option");
        const notes = section.getByLabel("What help do you need for this task?");
        const request = async (value) => {
          await choices.selectOption(value);
          await notes.fill(`Coaching requested for ${code}. I will verify the outcome independently.`);
          const save = page.waitForResponse(r => r.url() === base + "/api/pilot" && r.request().method() === "POST");
          await section.getByRole("button", { name: "Request help for this task" }).click();
          const response = await save;
          assert.equal(response.status(), 200);
          return response.json();
        };
        const prompt = await request("AI_PROMPT");
        assert.deepEqual(prompt.guidance.sections.map(row => row.text), [guide.fields["FIRE prompt"], guide.fields["STORY prompt"]]);
        await section.getByText(`${guide.title} · FIRE / STORY prompts`, { exact: true }).waitFor();
        const detailed = await request("GUIDE");
        assert.deepEqual(detailed.guidance.sections.map(row => row.text), ["Purpose", "Steps", "Example", "Evidence"].map(name => guide.fields[name]));
        await section.getByText(`${guide.title} · Detailed testing guide`, { exact: true }).waitFor();
        const { ticketId } = await request("MC_ONE_TO_ONE");
        const ticket = await models.HelpTicket.findById(ticketId).lean();
        assert.equal(ticket.taskId, taskId);
        assert.equal(ticket.assignedTo, mc._id);
        assert.equal(ticket.createdBy, gamer._id);
        assert.ok(ticket.description.includes(frozen.sprint4Help.coaching));
        const spends = await models.PilotLedger.find({ userId: gamer._id, state: "HELP_PASS", "data.taskId": taskId }).lean();
        assert.deepEqual(spends.map(row => row.data.package).sort(), ["AI_PROMPT", "GUIDE", "MC_ONE_TO_ONE"]);
        assert.ok(spends.every(row => row.data.amount === -1));
        await page.reload();
        dialog = await openCard();
        await dialog.getByText(`${guide.title} · FIRE / STORY prompts`, { exact: true }).waitFor();
        await dialog.getByText(`${guide.title} · Detailed testing guide`, { exact: true }).waitFor();
        const receipt = dialog.getByText(`MC 1:1 request saved for ${code}. Help Desk ticket ${ticketId}.`, { exact: true });
        await receipt.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(output, screenshot) });
        results.push({ id: helpId, code, observed: `Chrome unlocked the exact frozen ${guide.title} prompts and guide and saved a Help Desk ticket scoped to this task and assigned to its MC. Three approved debits were recorded; help and ticket receipt persisted after reload.`, screenshot, ticketId });
      } else {
        const hasDedicatedGuides = /FIRE|STORY|Detailed guide|MC 1:1/i.test(await dialog.innerText());
        await page.screenshot({ path: resolve(output, screenshot) });
        results.push({ id: helpId, code, observed: hasDedicatedGuides
          ? "Task content matched a guide term. Guide contents and all three paths need manual confirmation."
          : "Task detail shows instructions and a free Curriculum clue link. No task-specific FIRE/STORY, detailed guide, or MC 1:1 controls appeared in the task detail.", screenshot });
      }
      const evidenceUrl = `https://evidence.example.invalid/${code}`;
      const summary = `Expected: frozen ${code} instructions present. Actual: the signed-in owner saw the matching instructions in Chrome; no result was approved.`;
      await context.route(evidenceUrl, route => route.fulfill({ contentType: "text/plain", body: summary }));
      const submit = dialog.getByRole("button", { name: "Attach attributed evidence link" });
      await dialog.getByLabel("Repository, commit, test or demo URL").fill(evidenceUrl);
      await dialog.getByLabel("Contribution and verification performed").fill(summary);
      const saved = page.waitForResponse(r => r.url() === base + "/api/pilot" && r.request().method() === "POST");
      await submit.click();
      assert.equal((await saved).status(), 200);
      await dialog.getByRole("link", { name: summary, exact: true }).waitFor();
      await page.reload();
      dialog = await openCard();
      const link = dialog.getByRole("link", { name: summary, exact: true });
      assert.equal(await link.getAttribute("href"), evidenceUrl);
      assert.match(await dialog.innerText(), /Working · Owner/);
      const popupPromise = page.waitForEvent("popup");
      await link.click();
      const popup = await popupPromise;
      await popup.getByText(summary, { exact: true }).waitFor();
      await popup.close();
      const evidenceShot = `${helpId + 1}-${code}-evidence.png`;
      await page.screenshot({ path: resolve(output, evidenceShot) });
      results.push({ id: helpId + 1, code, observed: "Chrome saved the expected/actual summary and link, preserved both after reload, and opened the synthetic evidence receipt. The task stayed Working.", screenshot: evidenceShot });
    } finally {
      await context.close();
      await writeFile(resolve(output, "results.json"), JSON.stringify(results, null, 2) + "\n");
    }
  }
  assert.equal(await models.PilotSprint.countDocuments({ cohortId, "data.acceptances.0": { $exists: true } }), 0);
  console.log(`Verified ${results.length} browser observations. No isolated acceptance records created.`);
} finally {
  await browser?.close();
  server?.kill();
  await mongoose.disconnect();
  await replica.stop();
}
