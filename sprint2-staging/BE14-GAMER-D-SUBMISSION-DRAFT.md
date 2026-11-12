# BE-14 API behaviour testing · Gamer D submission draft

**Assigned Gamer** Ananya Reddy (D) · **Team** Fictional Team A · **Status** Draft for owner verification and reviewer decision

**Candidate SHA-256** `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde`

This draft maps the isolated QA runs to the frozen card. A supplemental run on the pinned build passed 15 checks and matched nine exact JSON error bodies, covering authentication, authorisation, invalid postcode and duplicates. It verified that the rejected edit left the profile unchanged and that the rejected duplicate left the directory at 20 records. Gamer D should identify their own tests before submitting. [Sanitised error-contract trace](sprint4-trusted-origin-rc/be14-error-contract-evidence.json)

| Scenario | Expected | Observed | Evidence or contract |
| --- | --- | --- | --- |
| Valid administrator login and own-profile read as alumnus | 200 | 200 | [OP-15 API measurements](sprint4-trusted-origin-rc/batch-20261110/measurements.json) · [Browser login trace](sprint4-trusted-origin-rc/localhost-browser-requests.json) |
| Invalid login, unsigned directory, signed-out session | 401 | 401 | Captured JSON `error` values were “Invalid email or password.” and “Sign in first.” |
| Alumnus directory, other profile, Create and Edit | 403 | 403 | Captured JSON `error` values were “Administrator access required.” and “You can only view your own profile.” |
| Create valid record and edit existing record as administrator | 201 and 200 | 201 and 200 | Edited record reopened with the same ID and saved value after re-login. [Workflow request trace](sprint4-trusted-origin-rc/op13-final-dry-run/workflow.json) |
| Invalid postcode and other invalid payloads | 400 | 400 | The captured postcode error was “Enter a postcode valid for the selected country.” The earlier regression covered 16 invalid cases. [Regression log](sprint4-trusted-origin-rc/batch-20261110/qa15-sprint1-2.log) |
| Duplicate email or registration | 409 | 409 | The duplicate-email response body matched “Email or registration number already exists.” The concurrent duplicate-create test yielded one 201 and one 409. [Regression log](sprint4-trusted-origin-rc/batch-20261110/qa15-sprint1-2.log) · [Race trace](sprint4-trusted-origin-rc/batch-20261110/measurements.json) |

[Pinned API source for the error contracts](sprint4-trusted-origin-rc/source/sprint2-staging/staging.mjs)

| Submission and review field | Entry |
| --- | --- |
| Gamer D’s own test cases, requests and observations | |
| QA reference for sanitised error bodies | [15-check trace](sprint4-trusted-origin-rc/be14-error-contract-evidence.json) |
| Gamer evidence and any task or defect IDs | |
| Submission reference and time (IST) | |
| Authorised reviewer, outcome, reason and time (IST) | |

BE-14 acceptance is pending. OP-13 remains unapproved, the handover email is unsent, and both keys remain pending.
