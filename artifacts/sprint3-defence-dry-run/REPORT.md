# Sprint 3 defence dry run · Fictional Team A

All five technical rehearsals passed on the isolated Sprint 3 baseline. The SHA-256 matched the recorded Key 2 baseline, `4d872356e6cb8f439da2ce84b4599a70bdda9b61f63a847d7761b4019c69f6cc`. The fresh INC-04 replay reproduced the gateway failure, restored the original routing and records, and passed the API regression, compiled UI smoke and reset checks. The older 14-check browser index was verified as historical evidence. This run used local HTTP/API requests and simulated each slot, so all five independent defence outcomes remain pending. The disposable instances were closed after capture.

[Fresh incident evidence](inc04.json) · [Five slot traces](defences.json) · [Existing restored browser evidence](../../sprint2-staging/restored-gateway-evidence/index.html)

| Gamer / task IDs | Dry run | Gamer still demonstrates and records | Karun asks and verifies |
| --- | --- | --- | --- |
| Aarav Patel · DB-09, DB-10, DB-11, QA-12 | 20 fictional rows and seed profile readable after rollback. | Name the rows and fields personally compared before and after INC-04. Reopen a persisted Create/Edit result and attach the QA-12 handoff to deployment. | What would justify restoring data instead of routing? Verify the record IDs and the evidence for unchanged data. |
| Priya Sharma · QA-09, QA-10, QA-11, OP-12 | Fresh replay proved gateway 404 versus direct API 200. Restored health and directory responded. | Show expected and actual shell, gateway and direct API outcomes. Identify the checks personally run, the QA-09 and OP-09 inputs for QA-11, and restored smoke evidence. | What stops release even if the page loads? Verify which results are Priya's own. |
| Rohan Gupta · OP-09, OP-10, OP-11, FE-12 | Verified pinned fingerprint, healthy restored app and profile read. | Show readiness, target comparison, rollback evidence and the QA-12 handoff used. Demonstrate repaired gateway login and profile read in browser. | How did you prove the original target and user journey were restored? Verify the traces reference the restored gateway. |
| Ananya Reddy · FE-09, FE-10, FE-11, BE-12 | Invalid postcode returned 400 without changing the record. Alumnus edit and directory returned 403. | Trace the browser action to the API and result before and after repair. Demonstrate validation and a restricted action, and show the backend evidence received. | Why is hiding Edit insufficient? Verify both browser behaviour and server-side rejection. |
| Kabir Khan · BE-09, BE-10, BE-11, DB-12 | A fictional edit retained its record ID and matched after fresh sign-in. | Trace gateway, API and database using the before/after evidence. Reopen a saved update after re-login and identify each handover. | How would you distinguish misrouting from a database save failure? Verify Kabir's own trace and saved result. |

## Session setup and records

On the isolated staging computer, Karun runs `node sprint2-staging/verify.mjs` from the Jungle workspace and checks the fingerprint. Then run `node sprint2-staging/staging.mjs` and open `http://127.0.0.1:3112/`. The launcher generates fresh fictional credentials in the local terminal. Use the built-in admin or alumnus account as appropriate and sign out between slots. Keep credentials and cookie values out of evidence.

For each slot, Karun records the Gamer, assessor, actual start and finish in IST, task IDs, the Gamer's own evidence link and action, expected and observed result, handover recipient and use, exact question and observed answer, plus PASS, FAIL or BLOCKED with reason. A shared trace can support the demonstration, while individual attribution must come from the Gamer. Attach the five witnessed records to AC-7 and review all seven Sprint 3 gates. Key 3 and Key 4 remain pending.

[CC session records](../../sprint2-staging/CC-SESSION-RECORDS.md) · [CC gate matrix](../../sprint2-staging/CC-REVIEW-PACK.md)
