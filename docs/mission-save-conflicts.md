# Mission draft conflict recovery

“Attempt changed in another session” was a version conflict, not a sign-in expiry. The latest fix addresses the mission save protocol; the unrelated persistent sign-in changes were removed.

Attempt-save requests now include the editor's acknowledged answer baseline and original attempt start/submission identity. When another save advances the version, the server performs a three-way merge. Independent edits are preserved automatically. Notebook cursor and practice-board navigation cannot block answer saving. Competing edits to the same answer or lab state return a bounded comparison for the authenticated owner only.

The player can compare their answer with the saved answer and choose which conflicting version to keep. Unrelated edits are retained. The existing editor stays mounted; no refresh, retry debit or new mission is required. Save errors stay visible, and close/keep-editing leaves the local editor intact. Such review controls belong to conflict resolution, not the automatic reward animations.

Attempt versions advance only from acknowledged saves. Polls cannot advance or rewind a dirty editor's baseline. Submission flushes a fresh save even when its local value appears unchanged, then submits the server's reconciled draft rather than an old React closure's answer object.

Original mission deadlines, submission sealing, account/college authorization, rewards and retry rules remain enforced. Reconciliation cannot revive an expired mission or transfer an old attempt into a restarted attempt. Clients without the new baseline protocol retain optimistic version checks. The attempt-save body limit alone is 200 KB to hold the bounded current and baseline answers; other routes keep their previous limits.

Deploy these changes together. No migration or live player reset is required. Old pages cannot gain the new protocol without loading the updated client, so any currently unsaved text should be copied before that deployment refresh.

Regression coverage: `tests/attempt-save-conflicts.test.mjs` verifies real database recovery, conflict preservation, attempt boundaries, owner scope and canonical submission. `tests/saved-work-version.test.mjs` verifies stale polls, editor reconciliation, forced submission saves and in-place conflict resolution.
