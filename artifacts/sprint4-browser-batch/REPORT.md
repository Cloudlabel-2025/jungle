# Sprint 4 isolated browser batch

This report records the original batch. The four guidance blockers below were closed by the [frozen help retest](../sprint4-frozen-help/REPORT.md). The Gamer sessions and other CC actions remain open.

This batch uses Chrome, the local CODEWILD build and a disposable fictional cohort. The four sampled cards represent functional testing (QA-13), non-functional testing (OP-15), system/E2E (QA-15) and UAT (UAT-01). The fixture puts these cards in Working to exercise the browser forms directly. It does not count as a protected Gamer session or a release approval.

Use [the browser results](results.json) and the workbook's QA cases tab for observed outcomes and screenshots. Filter to Sprint4 and BLOCKED for the remaining cases.

PB-QA-028, 030, 032 and 034 passed. The owner attached an expected/actual summary and a synthetic HTTPS evidence receipt, then reloaded and opened the link in Chrome. The task stayed Working. The browser test supplied the receipt from the fixture, so this does not verify real private file storage. PB-QA-027, 029, 031 and 033 remain blocked. Chrome displayed each card's instructions and free clue link. The three task-specific help paths and approved resource content still need configuration and verification.

The 19 open Sprint 4 IDs are 027, 029, 031, 033 (guidance); 036, 038, 040, 042, 043, 044 (independent UAT and next-day evidence); 056–062 (CC gates); 063 (formal QA-15 regression); and 064 (Friday blocker and repair retest).

## What the Gamers need to do

| Gamer | Card | Independent browser exercise |
| --- | --- | --- |
| Aarav Patel | UAT-01 | Create and edit a fictional record. Capture expected and actual results, validation and persistence. |
| Priya Sharma | UAT-02 | Run boundary and invalid-input cases. Capture rejected writes and whether data stayed unchanged. |
| Rohan Gupta | UAT-03 | Verify edits after refresh and a fresh sign-in. Capture identity and timestamp evidence. |
| Ananya Reddy | UAT-04 | Check permissions and record accuracy in the approved fictional roles. Capture the denial and permitted outcomes. |
| Kabir Khan | UAT-05 | After OP-13 acceptance and the timed handover, run Friday smoke and release retest, then record the independent recommendation. |

Each Gamer records their own 2.5-hour session, build fingerprint, actual start and finish with timezone, record IDs, expected and actual results, screenshots or trace, defects and PASS/FAIL/BLOCKED verdict. If a case finds a genuine blocker, record it and verify that it remains visible on the next day. If no real defect is found, preserve the genuine no-defect result and use a separately labelled controlled fixture for the negative case. See [the CC session records](../../sprint2-staging/CC-SESSION-RECORDS.md).

## What Karun needs to do

1. Confirm the approved task-specific FIRE/STORY prompts and guides for the four test categories and provide the resources or their configured links. Witness that the Gamer can reach each resource and the task-scoped MC 1:1 path.
2. Review the five independent UAT records and attach them to S4-AC-04. Verify the evidence, approved environment and separate Gamer and CC decisions. For a blocking Friday finding, retain the pre-fix result, repair evidence, repeat test and release disposition.
3. Review OP-15, attach the accepted QA-15 prerequisite records, and after Sprint 3 acceptance run the formal 21-check regression on the pinned build. Save the per-check verdicts, evidence and elapsed time against the three-hour target. See [QA-15 readiness](../../sprint2-staging/QA15-READINESS.md).
4. Verify the smoke and rollback reference and record OP-13 disposition. For Kabir, record actual OP-13 acceptance, release handoff and eligible receipt times. Kabir acknowledges after one working hour and before beginning UAT-05. The [closeout checklist](../../sprint2-staging/CC-CLOSEOUT-CHECKLIST.md) carries the prerequisites in order.
5. Review S4-AC-01 through S4-AC-07, including the remaining defects or approved deferrals. The batch leaves Key 3 and Key 4 pending.
