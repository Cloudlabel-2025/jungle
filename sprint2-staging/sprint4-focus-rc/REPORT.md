# Sprint 4 focus-fix release candidate

Fictional Team A. The isolated candidate was built from the pinned source with the Create alumni focus patch. The release SHA-256 is `dfef38d57399aeb1785eb5f7e01fa4f3b561ec576943c958f70ea53e8f17a419`. The fingerprint covers four source files and the dependency lockfile. Only the UI differed from the parent snapshot. [Release manifest](release.json)

## Rerun results

| OP-15 read concurrency | Requests | Errors | p95 | Max |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 90 | 0 | 7.84 ms | 11.51 ms |
| 4 | 90 | 0 | 8.46 ms | 17.90 ms |
| 8 | 90 | 0 | 12.91 ms | 16.60 ms |

OP-15 ran short bursts on localhost with 20 seed records. All nine sampled access checks matched expectations. The duplicate-create race left one record, a second session reopened it, and a clean-seed relaunch reached health in 449.90 ms and rejected the old session. The loopback fixture used HTTP with HttpOnly and SameSite=Strict cookies. The Secure cookie flag and HTML CSP were absent in this fixture. [Measurements](measurements.json)

OP15-A11Y-01 passed on the new release at both the 320 px and default viewports. Opening Create alumni focused the heading, the next Tab moved to First name in the narrow test, and Cancel restored focus to the Create button. The narrow form had 19 labelled controls and no horizontal page overflow. [Focus on heading](01-create-heading-focused.jpg) · [Restored focus](02-create-trigger-refocused.jpg)

UAT-05 passed in the accelerated workflow. OP-13 completed after the prerequisite reviews, the engine enforced the one-working-hour handover, and Gamer E completed the Friday card on the fixture clock. The candidate passed smoke and clean-seed relaunch checks. API checks covered Create/Edit, rejected invalid input, cross-session persistence and alumnus access restrictions. A separate browser instance of the same release rejected the invalid postcode, saved the corrected profile and city, and reopened the same ID after refresh and re-login. [Workflow and HTTP trace](workflow.json) · [Browser observations](browser.json) · [Validation](03-invalid-postcode.jpg) · [Reopened profile](04-profile-reopened.jpg)

The copied candidate’s Sprint 1–2 verifier passed its API checks and clean-seed reset. [Regression log](sprint1-2-regression.log)

## CC decisions still pending

- Confirm this fingerprint and the approved staging URL. Approve OP-15 criteria and verify workload, recovery of retained data, deployed HTTPS and session controls, and accessibility and usability coverage against those criteria.
- Verify OP-13 release and rollback evidence and collect five independent, attributable 2.5-hour Gamer UAT sessions. Gamer E’s Friday session follows the accepted OP-13 handover.
- Complete the five Sprint 3 defences and CC gate review for Key 3. Verify QA-15 regression against all 21 accepted Sprint 1–3 checks, disposition defects, and decide all seven Sprint 4 gates before Key 4.

Key 3 and Key 4 remain pending. The live game was untouched.
