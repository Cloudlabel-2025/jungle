# Sprint 4 Help Pass UI retest

Ran on 10 November 2026 against the disposable localhost Sprint 4 fixture. All accounts, coaching requests, and evidence were synthetic. No live data or credentials were used.

| Check | Observed result | Status | Evidence |
| --- | --- | --- | --- |
| S4-HP-B06 task picker | QA Gamer 0 saw General help, owned BE-05, BE-06, DB-08, and co-assigned BE-07. Other teammates’ tasks were absent. | PASS | 01-co-assigned-task.jpg |
| S4-HP-B06 feedback placement | A no-credit submission displayed the server error inside the Request help form, immediately above the submit button and inside the viewport. | PASS | 02-earned-help-inline-error.jpg |
| Sponsorship validation and retry | Selecting a donor without a pass displayed “The donor needs one unused personal Help Pass” inside the sponsorship form. Selecting an eligible donor and resubmitting cleared that error and saved a PENDING request. | PASS | 03-sponsorship-inline-error.jpg, 04-sponsorship-retry-saved.jpg |
| Redemption on an owned task | QA Gamer 2 redeemed the fixture’s earned credit on owned task QA-05 and received the synthetic approved resource link. | PASS | 05-owned-task-redemption.jpg |
| Redemption on a co-assigned task | QA Gamer 0 submitted a Weekly Quest in the browser. MC passed it. The Gamer redeemed the credit on BE-07. The resource link and zero credit balance persisted after refresh. | PASS | 06-co-assigned-task-redemption.jpg |

The server authorization and credit rules were left in place. The retest used the synthetic prompt link to verify issuance. Key 3 and Key 4 remain pending.
