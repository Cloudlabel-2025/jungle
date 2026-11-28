import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function component(path, name = "default") {
  const bundle = await build({
    entryPoints: [path],
    bundle: true,
    packages: "external",
    platform: "node",
    format: "cjs",
    write: false,
    alias: { "@": resolve(".") },
    loader: { ".js": "jsx" },
    jsx: "automatic",
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(
    createRequire(import.meta.url),
    module,
    module.exports,
  );
  return module.exports[name];
}

test("MC and CC see the automatic result beside the corrected result and previous decision",async()=>{
  const Review=await component("components/PlayerResultReview.js");
  const automatic={source:"SYSTEM",completed:true,stars:3,checks:{onTime:true},reason:"Automatic evidence checks met"};
  const levelOne={automatic,result:{source:"MISSION_COMMANDER",completed:true,stars:1},history:[],creditedTrophies:15,creditedXp:75,overrideHistory:[{result:automatic,actorId:"reviewer",at:"2026-11-27T10:00:00Z",reason:"Reviewed mission evidence"}]};
  for(const role of ["MISSION_COMMANDER","CENTRE_COMMAND"]){
    const data={user:{_id:"reviewer",role},dayOne:{records:[{userId:"p",version:1,config:{genres:[]},submissions:[],levelOne}]},weekOneProgram:{levelTargets:{members:[{_id:"p",name:"Player",trophies:15}]},attempts:[],levelResults:[]}};
    const html=renderToStaticMarkup(React.createElement(Review,{data,act:async()=>true}));
    for(const text of ["EARNED STARS","ACTUAL RESULT","3/3 stars","Actual result: 1/3 stars","Staff correction","Previous result decisions","Reviewed mission evidence","Validate result","Correct result","Validation notes"])assert.ok(html.includes(text),`${role}: ${text}`);
    assert.ok(html.includes('aria-label="3 of 3 stars earned"'),"earned stars are shown visually and labelled for assistive technology");
    assert.ok(html.includes('aria-label="1 of 3 stars earned"'),"the corrected result shows its actual stars");
  }
});

test("full history renders every chat link, transcript and answer revision, and keeps unsafe links as text",async()=>{
  const List=await component("components/SubmissionHistory.js","SubmissionHistoryList");
  const history={attempts:[{attempt:1,archived:true,archivedAt:"2026-11-27T10:00:00Z",reason:"Approved replay",missions:[{id:"research",title:"Research",submissions:[{id:"s1",at:"2026-11-26T10:00:00Z",url:"https://example.org/old",transcript:"Earlier saved transcript"},{id:"s2",at:"2026-11-26T11:00:00Z",url:"https://example.org/revised",answers:{notes:"Revised answer",source:"https://example.org/source"},late:true}]}]},{attempt:2,archived:false,missions:[{id:"quiz",title:"Quiz",questions:[{id:"q1",prompt:"Choose the correct source",options:["A source","B source"]}],submissions:[{id:"s3",at:"2026-11-27T10:00:00Z",answers:{q1:1,notes:"Current answer",url:"javascript:alert(1)"},expired:true}]}]}]};
  const html=renderToStaticMarkup(React.createElement(List,{history}));
  for(const text of ["https://example.org/old","https://example.org/revised","Earlier saved transcript","Revised answer","Current answer","Revision 2","Archived attempt","Current attempt","Choose the correct source","B source","Timer expired"])assert.ok(html.includes(text),text);
  assert.ok(!html.includes('href="javascript:'));
});

test("expired levels expose an understandable paid retry and zero-energy recovery path",async()=>{
  const Retry=await component("components/FlightLevelRetry.js");
  const now=new Date("2026-11-28T10:00:00Z"),old="2026-11-28T09:00:00Z";
  const data={user:{_id:"p",role:"GAMER",energy:2},dayOne:{records:[{userId:"p",startedAt:old,deadline:old,levelOne:{attempt:1}}]},weekOneProgram:{levelResults:[],attempts:[2,3,4,5].map(day=>({userId:"p",day,data:{startedAt:old,deadline:old}}))}};
  for(const day of [1,2,3,4,5]){
    const html=renderToStaticMarkup(React.createElement(Retry,{data,day,now,act:async()=>true}));
    assert.ok(html.includes("Time’s up. Try this level again."));
    assert.ok(html.includes("Retry Level "+day+" · 1 energy"));
    assert.ok(html.includes("previous submissions and rewards stay saved"));
  }
  const empty=renderToStaticMarkup(React.createElement(Retry,{data:{...data,user:{...data.user,energy:0}},day:1,now,act:async()=>true}));
  assert.ok(empty.includes("Open energy recovery"));
  assert.ok(!empty.includes('class="btn primary"'));
});

test("review evidence shows question text, readable options and labelled checks without raw data disclosures",async()=>{
  const Answers=await component("components/ResultReviewEvidence.js","ReviewAnswers");
  const Checks=await component("components/ResultReviewEvidence.js","ScoringChecks");
  const html=renderToStaticMarkup(React.createElement(Answers,{questions:[{id:"q1",prompt:"Which source supports the claim?",options:["An anonymous comment","The original research paper"]}],answers:{q1:1,notes:{finding:"Compared the original source",confirmed:true},url:"javascript:alert(1)"}}));
  for(const text of ["Which source supports the claim?","The original research paper","Player’s finding","Compared the original source","Confirmed","Yes"])assert.ok(html.includes(text),text);
  assert.ok(!html.includes("[object Object]") && !html.includes('&quot;finding&quot;') && !html.includes('href="javascript:'));
  const checks=renderToStaticMarkup(React.createElement(Checks,{automatic:{reason:"Evidence reviewed",checks:{detailedNotes:true,freshChat:false}}}));
  for(const text of ["Notes include enough detail","A new AI conversation was submitted","Met","Not met"])assert.ok(checks.includes(text));
  assert.ok(!checks.includes("<details"),"scoring checks must be readable without opening another dropdown");
});
test("player result reveals stars, exact rewards, replay history and release gating", async () => {
  const Result = await component("components/LevelOneResult.js");
  const level = {
    result: {
      completed: true,
      stars: 3,
      source: "SYSTEM",
      reason: "Evidence checks met",
      elapsedSeconds: 600,
    },
    creditedTrophies: 30,
    creditedXp: 150,
    history: [],
  };
  let html = renderToStaticMarkup(React.createElement(Result, { level }));
  for (const text of [
    "3 of 3 stars",
    "Level 1 complete!",
    "30",
    "150",
    "Continue your journey from the flight map",
  ])
    assert.ok(html.includes(text), text);
  level.practice = true;
  level.attempt = 2;
  level.bestResult = level.result;
  level.history = [
    {
      attempt: 1,
      result: level.result,
      reason: "Practice requested",
      submissions: [
        {
          id: "saved",
          url: "https://example.org/saved",
          transcript: "Saved User: and Assistant: conversation",
        },
      ],
    },
  ];
  html = renderToStaticMarkup(React.createElement(Result, { level }));
  assert.ok(html.includes("Replay · attempt 2"));
  assert.ok(html.includes("https://example.org/saved"));
  assert.ok(html.includes("earned completion is retained"));
});
test("staff sees scoped member/team controls and ordinary players do not", async () => {
  const Controls = await component("components/LevelOneControls.js");
  const data = {
    user: { role: "MISSION_COMMANDER" },
    dayOne: {
      state: "OPEN",
      records: [{ userId: "p1", version: 2 }],
      levelOneTargets: {
        members: [{ _id: "p1", name: "Explorer One", teamId: "t1" }],
        teams: [{ _id: "t1", name: "Test Team" }],
      },
    },
  };
  const render = () =>
    renderToStaticMarkup(
      React.createElement(Controls, {
        data,
        act: () => {
          throw Error("render must not change results");
        },
        initialUserId: "p1",
      }),
    );
  const html = render();
  for (const text of [
    "Explorer One",
    "Test Team",
    "Reopen",
    "Allow replay",
    "Affected members (1)",
    "Confirm for 1 member",
  ])
    assert.ok(html.includes(text), text);
  data.user.role = "GAMER";
  assert.equal(render(), "");
});
test("a staff-completed mission cannot show an active research form or timer", async () => {
  const Briefing = await component("components/FlightMissionBriefing.js");
  const record = {
    submissions: [],
    acknowledgedAt: "accepted",
    startedAt: "started",
    levelOne: {
      result: {
        completed: true,
        stars: 2,
        source: "MISSION_COMMANDER",
        reason: "Reviewed individual work",
      },
      creditedTrophies: 15,
      creditedXp: 75,
      history: [],
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(Briefing, {
      record,
      question: {
        id: "fitness-3",
        name: "Mission",
        question: "Investigate your question",
      },
      timer: "89:00",
      children: React.createElement(
        "span",
        null,
        "ACTIVE_FORM_SHOULD_BE_HIDDEN",
      ),
    }),
  );
  assert.ok(html.includes("Level 1 complete!"));
  assert.ok(!html.includes("ACTIVE_FORM_SHOULD_BE_HIDDEN"));
  assert.ok(!html.includes("Research time remaining"));
  assert.ok(html.includes("level-one-result is-compact"));
  assert.ok(html.includes("View review"));
  assert.ok(!html.includes("<summary>Review details"));
});

test("research transmission asks for a shared link without a transcript field", async () => {
  const Mission = await component(
    "components/DayOneFeatures.js",
    "DiscoveryMission",
  );
  const config = {
    selectionMode: "research-2026-11-12",
    genres: [
      {
        id: "mysteries-2",
        name: "Mission",
        question: "Investigate the evidence",
      },
    ],
  };
  const record = {
    _id: "record",
    userId: "p1",
    config,
    genreId: "mysteries-2",
    acknowledgedAt: "2026-11-14T08:00:00Z",
    startedAt: "2026-11-14T08:01:00Z",
    deadline: "2026-11-14T09:31:00Z",
    submissions: [],
  };
  const html = renderToStaticMarkup(
    React.createElement(Mission, {
      data: {
        user: { _id: "p1" },
        dayOne: { state: "OPEN", records: [record], config },
      },
      act: () => {},
      now: new Date("2026-11-14T08:10:00Z"),
      game: true,
    }),
  );
  assert.ok(html.includes('type="url"'));
  assert.ok(html.includes("no transcript is needed"));
  assert.ok(!html.includes("<textarea"));
  assert.ok(html.includes("Transmit research chat"));
  assert.ok(html.includes("How to earn 3 stars"));
});

test("star guide explains actual thresholds, rewards and saved deadline without promising an expired third star", async () => {
  const Guide = await component(
    "components/LevelOneStarGuide.js",
    "LevelOneStarGuideContent",
  );
  const record = {
    deadline: "2026-11-14T09:30:00Z",
    config: { timeZone: "Asia/Kolkata" },
  };
  const html = renderToStaticMarkup(
    React.createElement(Guide, {
      record,
      now: new Date("2026-11-14T10:00:00Z"),
    }),
  );
  for (const text of [
    "at least 80 words",
    "3 player messages and 3 AI responses",
    "HTTPS source link",
    "Your research deadline has passed",
    "2 stars",
    "30",
    "150",
    "no pasted transcript needed",
    "awards only the difference",
  ])
    assert.ok(html.includes(text), text);
  const beforeStart = renderToStaticMarkup(
    React.createElement(Guide, { record: { config: { durationMinutes: 75 } } }),
  );
  assert.ok(beforeStart.includes("75 minutes"));
  assert.ok(!beforeStart.includes("deadline has passed"));
});

test("mission report uses saved research checks and never invents checks for a staff result", async () => {
  const Report = await component(
    "components/LevelOneReview.js",
    "LevelOneReviewReport",
  );
  const level = {
    creditedTrophies: 10,
    creditedXp: 50,
    result: {
      completed: true,
      stars: 1,
      source: "SYSTEM",
      reason: "Follow-up work needed",
      checks: {
        checkpoints: true,
        readable: true,
        related: true,
        followUp: false,
        comparison: true,
        sources: true,
        onTime: true,
      },
      evidence: { userTurns: 1, assistantTurns: 1 },
    },
  };
  let html = renderToStaticMarkup(React.createElement(Report, { level }));
  assert.ok(html.includes("Follow-up research"));
  assert.ok(html.includes("To improve"));
  assert.ok(html.includes("Your chat: 1 player message · 1 AI response"));
  assert.ok(html.includes("Replacing the link does not restart your timer"));
  level.result = {
    completed: true,
    stars: 3,
    source: "CENTRE_COMMAND",
    reason: "Approved after individual review",
  };
  html = renderToStaticMarkup(React.createElement(Report, { level }));
  assert.ok(html.includes("Reviewed by CC"));
  assert.ok(!html.includes("Research checks"));
  assert.ok(!html.includes("To improve"));
});

test("sky map renders completed Level 1, earned star icons and aircraft beyond its checkpoint", async () => {
  const Map = await component("components/SkyFlightMap.js");
  const data = {
    user: { _id: "p1" },
    story: { flight: true, introComplete: true },
    dayOne: {
      state: "OPEN",
      records: [
        { userId: "p1", levelOne: { result: { completed: true, stars: 1 } } },
      ],
    },
    weekOneProgram: {
      days: [
        { day: 1, state: "OPEN" },
        { day: 2, state: "PREPARED" },
      ],
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(Map, { data, act: () => {} }),
  );
  assert.ok(html.includes("is-verified is-completed"));
  assert.ok(html.includes(">Completed</em>"));
  assert.ok(html.includes('aria-label="1 of 3 stars earned"'));
  assert.ok(html.includes("View result"));
  assert.ok(html.includes("Level 2: Explore. Awaiting mission release"));
  assert.ok(html.includes(`left:${(405 / 2800) * 100}%`));
});
