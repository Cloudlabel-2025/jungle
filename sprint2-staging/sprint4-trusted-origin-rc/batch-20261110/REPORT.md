# Isolated regression batch · 10 November 2026

All six batch checks passed. The staged checks used final candidate SHA-256 `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde`. Prior evidence remains available in the CC review pack.

| Check | Result | Evidence |
| --- | --- | --- |
| Application regression | 116 passed, zero failures or skips. Included the Help Pass integration checks. | [Test log](application-regression.log) |
| QA-15 Sprint 1–2 subset | API, smoke and clean reset passed over localhost HTTPS. | [Regression log](qa15-sprint1-2.log) |
| OP-15 | All 270 reads matched expectations. P95 was 8.98 ms, 42.29 ms and 56.43 ms at 1, 4 and 8 concurrent requests. The duplicate-create race and restart checks passed. | [Measurements](measurements.json) |
| Retained restore | All 21 fictional records and three index definitions matched. The later edit was excluded. Fresh launch through verified recovery took 926 ms. | [Recovery trace](exact-https-recovery.json) · [Snapshot](exact-https-retained-backup.ejson) |
| UAT-05 workflow | OP-13 release, one-working-hour handover and Friday scenario passed in the accelerated rehearsal. | [Workflow evidence](workflow.json) |
| Ten-session rehearsal | All five defence walkthroughs and all five UAT API scenarios passed with the fictional accounts. All 80 requests returned expected statuses. | [Session trace](cc-ten-session-rehearsal.json) |

The six checks ran sequentially. Browser evidence in the pack comes from the earlier Chrome runs on the same fingerprint. The ten-session rehearsal used the existing disposable account instance and added four uniquely tagged fictional records. Relaunch with a clean seed before the scheduled Gamer sessions.

The five witnessed defences, five independent UAT sessions, full 21-check QA-15 regression after Sprint 3 acceptance, and formal CC decisions remain pending. No messages or invites were sent. Key 3 and Key 4 remain pending. The live game was untouched. [Batch exit codes and durations](batch-results.json)
