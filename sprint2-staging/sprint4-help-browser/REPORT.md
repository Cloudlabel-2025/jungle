# Sprint 4 Help Pass browser walkthrough

Ran on 10 November 2026 at http://127.0.0.1:3184 in a disposable MongoDB replica with synthetic Gamer, donor, and MC accounts. The source app was copied without its environment files. The test used a synthetic task template and prompt URL. Neither key was issued and no live game was accessed.

| Test | Persona and screen | Steps and expected outcome | Observed outcome |
| --- | --- | --- | --- |
| S4-HP-B01 | Requester and donor, Campfire | Request coaching from a named donor and approve it from the donor account. Expect one pending request followed by approval. | PASS. Request showed PENDING then APPROVED. |
| S4-HP-B02 | MC, Rescue camp Help Desk | Record guidance and verify recovery. Try to resolve before documenting the actual MC 1:1. Then record the actual session and resolve. | PASS. Resolution initially returned “Record the completed MC 1:1 intervention before resolving sponsored help.” After session evidence, the ticket became RESOLVED and the requester saw COMPLETED. |
| S4-HP-B03 | Donor, Relics & honours. Requester, Campfire | Check the settled ledger and try to sponsor a second request from the same donor. Expect one debit and a lifetime-limit block. | PASS. Donor ledger showed +1 and exactly one −1. The next request returned “This donor has already sponsored an MC session in the programme.” |
| S4-HP-B04 | Gamer, Campfire. MC, Rescue camp | Start and submit a Weekly Quest. Review it as MC and select PASS. | PASS. Quest moved to IN_REVIEW, then PASS. The Gamer saw one guided AI Help credit. |
| S4-HP-B05 | Gamer, Campfire | Redeem on owned task BE-05. Retry, refresh, and sign out and back in. | PASS. The approved-resource link appeared and the balance fell to zero. Repeat redemption was blocked. The link and zero balance persisted across refresh and sign-in. The synthetic link was used to test issuance only. |
| S4-HP-B06 | Gamer, Campfire | Select earned guided AI Help. Inspect the related-task picker and submit using another Gamer’s task. Expect ineligible tasks to be excluded or disabled and authorization to be enforced. | FAIL, Low severity. The picker offered BE-07. The server correctly rejected it. The error rendered above the disclosure, outside the viewport at the submit position. |

## Reproduce S4-HP-B06

1. Use an exhausted Gamer in an active isolated Sprint 4. Open Campfire, Weekly programme work, and Client interruptions and assistance.
2. Choose Redeem earned guided AI Help.
3. In Related task, choose a task belonging only to another Gamer. In this fixture, use BE-07 as QA Gamer 0.
4. Enter a reason and click Request help. The UI accepts the selection, then reports “Optional assistance must relate to your assigned contribution.” Scroll to the top of the programme section to see the alert.

Expected UI behavior is to filter to assigned and co-assigned eligible tasks and surface submission feedback next to the form. The server authorization guard passed.

## Evidence

Screenshots are numbered in execution order. 05 shows requester completion, 12 shows persistence, 13 shows the donor ledger, and 14 shows the task validation error. The in-app browser JPEGs have limited text clarity, so the observed text is transcribed above and in browser-observations.txt.

Daily Discovery and cross-week carry-forward remained outside this browser session. They were covered by the isolated automated Help Pass suite.
