# OP-14 environment assessment · Gamer B submission draft

**Assigned Gamer** Priya Sharma (B) · **Team** Fictional Team A · **Status** Draft for owner verification and reviewer decision

**Candidate SHA-256** `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde`

This draft summarises isolated QA evidence. Gamer B should verify the scope, add their own observations and identify evidence they personally produced before submitting the card.

| Frozen requirement | Draft finding and evidence |
| --- | --- |
| Staging configuration | The pinned build was tested on Windows over loopback HTTPS. The browser-facing release URL was `https://127.0.0.1:3193/`. The launcher creates a disposable MongoDB instance, 20 fictional seed records and temporary role accounts. The build supports an exact trusted origin setting. [Release manifest](sprint4-trusted-origin-rc/release.json) · [Configuration report](sprint4-trusted-origin-rc/REPORT.md) · [Launcher](sprint4-trusted-origin-rc/launch-cc-sessions.mjs) |
| Health and smoke | The isolated preflight returned ready over Windows-trusted HTTPS. Regular Chrome verified sign-in, the 20-record directory and sign-out. Karun later confirmed all four release smoke checks passed. The exact witness run time, launcher hash and screenshot links are still open. [Preflight](sprint4-trusted-origin-rc/cc-localhost-preflight.json) · [Chrome retest](sprint4-trusted-origin-rc/LOCALHOST-CHROME-RETEST.md) · [Witness record](OP13-CHROME-WITNESS-CHECKLIST.md) |
| Logs and test tools | Evidence includes the launcher preflight, Chrome request trace and Node HTTPS verifier output. The traces record status and cookie attributes without credential or cookie values. [Browser trace](sprint4-trusted-origin-rc/localhost-browser-requests.json) · [Verifier output](sprint4-trusted-origin-rc/batch-20261110/qa15-sprint1-2.log) |
| Recoverable baseline | Clean relaunch restored the 20 pinned seed IDs. A separate fresh copy restored the verified retained snapshot with 21 matching records and three index definitions. All four Chrome smoke checks passed on the restored copy. [Clean relaunch](sprint4-trusted-origin-rc/op13-final-dry-run/workflow.json) · [Restored Chrome trace](sprint4-trusted-origin-rc/op13-restored-chrome-smoke/results.json) · [Rollback draft](OP13-ROLLBACK-DRAFT.md) |

| Submission and review field | Entry |
| --- | --- |
| Gamer B’s own observations, actions and evidence | |
| Task or defect IDs, reproduction notes and disposition | |
| Submission reference and time (IST) | |
| Authorised reviewer, outcome, reason and time (IST) | |

OP-14 acceptance is pending. OP-13 remains unapproved, the handover email is unsent, and both keys remain pending.
