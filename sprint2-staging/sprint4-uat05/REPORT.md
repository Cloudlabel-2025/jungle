# Fictional Team A — Sprint 4 OP-13 and UAT-05 rerun

**Result:** OP-13 unblocked UAT-05 in the disposable workflow. The accelerated Friday test passed. The real Gamer sessions, Sprint 3 sign-off, and formal Sprint 4 gate approvals remain pending. Key 3 and Key 4 are pending. The live game was untouched.

## Evidence

- [Frozen workflow, review IDs, handover timing, and HTTP trace](workflow.json). The runner checked the ZIP hashes, retained the frozen card IDs and dependencies, and exercised the normal task-review workflow with fictional personas. The prerequisite reviews were simulated. Before OP-13, UAT-05 could not start. After OP-13, it still required a received handover. Early receipt and a different Gamer’s start were both rejected. Gamer E received the handover, started on the simulated Friday, and completed UAT-05 through review. The 150 working minutes were advanced on the fixture clock.
- [Sprint 1–2 candidate regression and clean reset](sprint1-2-regression.log). The release fingerprint matched the isolated Key 2 record. The OP-13 run launched and relaunched the pinned candidate, verified health, HTML, React bundle, admin login, and all 20 pinned seed IDs, then ran UAT-05 against the relaunched instance. The previous [INC-04 restore evidence](../inc04-rehearsal-evidence.json) remains separate.
- Browser corroboration ran on a second disposable instance of the same pinned candidate. [Directory smoke](01-admin-smoke.jpg), [invalid postcode](02-invalid-postcode.jpg), [saved edit](03-edited-profile.jpg), and [reopened profile](04-reopened-after-relogin.jpg). The admin corrected the postcode, created the profile, edited its city, signed out, refreshed, signed in, and reopened the same record. [Browser observations](browser-observations.txt).
- The workflow’s API trace independently verified the invalid edit returned 400, a valid edit persisted with unchanged record ID and creation time, and an alumnus could read their own record but received 403 when reading or editing the admin-created record. The browser and API runs created different fictional records. The runner records local request timings as observations.

## CC verification before Key 4

| Gate | Evidence CC still needs to verify |
| --- | --- |
| S4-AC-01 Functional | Confirm the final candidate’s positive, negative, field validation and restricted-access coverage. Map any fixes, including Sprint 4 Help Pass UI fixes if in scope, to passing retest evidence. |
| S4-AC-02 Non-functional | Approve criteria, then review OP-15 measurements and limitations for performance under safe load, reliability, security, accessibility and usability. The local HTTP timings do not establish gate compliance. |
| S4-AC-03 System and E2E | Verify frontend, API and database results on the exact release URL and fingerprint CC will accept, including saved state after re-login and useful error behavior. |
| S4-AC-04 Five independent UAT sessions | Collect five attributable 2.5-hour Gamer sessions with Pass/Fail/Blocked findings. Gamer E must do the Friday retest after the accepted OP-13 handover. |
| S4-AC-05 Defect disposition | Verify fixes and retests, check that no acceptance blocker remains, and explicitly approve any minor deferrals. |
| S4-AC-06 Earlier 21 checks | Complete the five Sprint 3 defences and CC gate review. Once Sprint 3 is accepted, verify QA-15 regression evidence for all 21 accepted Sprint 1–3 checks on the final release and review the three-hour target. |
| S4-AC-07 Release and Key 4 | Confirm the final fingerprint, approved staging URL, smoke results, rollback proof, and disposition of all UAT findings. Record formal acceptance only after all seven gates are satisfied. |

The workflow rechecked that a Key 4 acceptance attempt was rejected with gates outstanding. The isolated Sprint 3 record was byte-identical after the run.
