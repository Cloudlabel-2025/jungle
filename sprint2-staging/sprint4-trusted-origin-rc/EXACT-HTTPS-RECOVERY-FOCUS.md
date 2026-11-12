# Retained restore and keyboard focus · Final localhost HTTPS candidate

Both retests passed for Fictional Team A on isolated Sprint 4 candidate SHA-256 `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde`.

## Retained data

The source HTTPS instance backed up 21 fictional documents, including a newly created and edited profile and an edit to an original profile. The runner stopped the source, launched a fresh instance of the same HTTPS build and applied the snapshot. All 21 documents and three index definitions matched. Both retained edits reopened over HTTPS with their original IDs and saved timestamps. A post-snapshot edit was excluded, duplicate creation returned 409 and the pre-restart session returned 401.

Export took **39 ms**, restore writes took **10 ms**, and fresh launch through verification took **2,088 ms**. The 11,259-byte snapshot has SHA-256 `2fa113f32f56ddde0f9b031cd5844188baab33a47b399400b586195119d06eea`. This was a logical collection restore onto the app’s startup indexes with fictional data. CC still needs to approve recovery targets and the representative workload for its chosen staging scope.

[Recovery trace](exact-https-recovery.json) · [Synthetic backup](exact-https-retained-backup.ejson) · [Runner](run-retained-restore.mjs)

## OP15-A11Y-01 keyboard focus

On regular Windows Chrome at `https://127.0.0.1:3193`, I used Tab and Enter throughout the Create and Cancel sequence. Chrome’s visible focus outline showed each transition. No form data was saved and the directory stayed at 20 records.

| Action | Observed focus |
| --- | --- |
| Tab from Sign out | [Create alumni button](exact-https-focus-01-create-trigger.png) |
| Press Enter | [Create alumni heading](exact-https-focus-02-heading.png) |
| Press Tab | [First name field](exact-https-focus-03-first-name.png) |
| Tab through the form | [Cancel button](exact-https-focus-04-cancel.png) |
| Press Enter | [Create alumni button restored](exact-https-focus-05-restored-trigger.png) |

The desktop Chrome check supersedes the inconclusive focus observation from the earlier exact-build run. The earlier focus-fix release supplies separate narrow-viewport evidence. [Chrome session trace](exact-https-focus-browser-requests.json) · [Earlier narrow-viewport retest](../sprint4-op15/focus-retest/REPORT.md)

The temporary QA certificate was removed and the disposable endpoint stopped. Key 3 and Key 4 remain pending. The live game was untouched.
