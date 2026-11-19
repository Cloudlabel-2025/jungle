# College account management

The main address opens the Super Admin CMS. Each college has its own portal URL. On localhost, College for test uses **http://college-for-test.localhost:3000/**; a path-based alternative is **http://localhost:3000/c/college-for-test**. Users open that address and enter only their username/email and password. The college name is fixed by the address, with no code field or college search. CCs then open **Manage college** and MCs open **Manage players**; both lead to their college's management workspace.

**Add college** previews the college's dedicated URL while its URL name is entered. The created college's overview displays the final URL with **Open college** and **Copy URL**. Existing College for test data is adopted at its existing mapping; no accounts, credentials or history are moved.

Staff management stays inside the normal VOW workspace: CCs use `/centre-command/college-management` and MCs use `/commander/college-management`. The same expedition navigation, header, notifications and sign-out controls remain available, and the management link is highlighted. The old `/college` address redirects to the signed-in staff member's workspace page. College and team permissions are still checked on the server.

The integrated workspace passed an isolated production build and 126 synthetic browser/API checks, including navigation with the same mounted header, CC creation of an MC, MC creation of a player, assigned-team restrictions and mobile landscape layout. Existing college data is not used by these checks.

The resolver follows the Lims-V1 approach: local college subdomains, optional production subdomains through COLLEGE_ROOT_DOMAIN, and /c/<college-url-name> fallback URLs for hosts without wildcard domains. College session cookies remain host-only, and the server verifies that the selected URL, submitted login target and authenticated college match. Root platform APIs are blocked on college subdomains. Shared-host fallback entry cookies select a college but never authorize access; existing signed sessions and college-ID checks still authorize every request.

Changing a college's display name leaves its URL intact. Editing its URL name changes the address while preserving the immutable college ID and database. Inactive or unknown college addresses do not fall through to another tenant. Recovery emails point to the college's own recovery URL, and college tokens cannot be used on another college host.

| Action | Super Admin | CC | MC / Guide |
| --- | --- | --- | --- |
| Create colleges or change college access | All colleges | No | No |
| Create or manage CC accounts | All colleges | No | No |
| Create and edit cohorts and teams | All colleges | Own college | No |
| Create, edit or deactivate MCs | All colleges | Own college | No |
| Create players | All colleges | Own college | Assigned teams only |
| Edit or deactivate players | All colleges | Own college | No |
| Assign or replace a team's MC | All colleges | Own college | No |

Players cannot use the management APIs. Existing explicit `roster:write` delegation restrictions still apply. MC is the existing `MISSION_COMMANDER` role, displayed as Guide; players use the existing `GAMER` role.

## Initial and permanent passwords

Every CC, MC and player account starts with an initial password. After signing in, the owner must enter **New password**, **Confirm password**, and select **Confirm password** before accessing their workspace. The new password must contain at least eight characters, match the confirmation and differ from the initial password. The server blocks normal college APIs until setup is complete; opening another dashboard or management URL does not bypass it.

The change saves a salted hash, records completion and invalidates older sessions. The current browser receives a fresh session and continues to the role's dashboard. A successful email password reset also completes password setup. Passwords are never shown to administrators or written to the audit trail.

Existing credentials without a recorded completion status require this step once. Their current password still works for that initial sign-in. No bulk password reset or historical-data migration is performed. Provisioning or reissuing an initial password marks the account for setup again.

Verification: the isolated production build, 106 first-sign-in browser/API checks across CC/MC/player roles, 126 CMS checks and 43 college-isolation checks passed. The expanded first-sign-in retest explicitly opens each role's dashboard, notifications, calendar, management/objectives page, legacy `/college` link and another role's dashboard before setup, then refreshes the page. Each attempt shows only password setup with no dashboard content. Read and write API attempts return `PASSWORD_CHANGE_REQUIRED`; after confirmation, the actual dashboard renders and stays available after refresh. The suite also checks legacy credentials, confirmation errors, rejected initial-password reuse, old-session invalidation, concurrent confirmations and unchanged historical records. Per-role results are saved privately under `.data/initial-password-qa/result.json`. Run `npm run test:password-setup:http` against a completed build; optional Playwright runtime and Chrome executable arguments include the browser flow.

## College-wide CC access

CC management access is derived from the authenticated college database and current account role. The management workspace shows every cohort in that college with a cohort selector. A CC's existing `cohortId` remains their home cohort for the game workspace. No accounts, progress or historical records are moved or duplicated to enable management of other cohorts.

In the Super Admin CMS, open a college and use **Add CC** in the college-level Centre Command section. Select a home cohort and provide a name, email and private initial password. The home cohort does not restrict college management. Existing CCs automatically receive the same college-wide management scope; no bulk migration is required. At least one active CC must remain in a college, including when multiple administrators submit concurrent changes.

## CC workflow

1. Open the college’s own URL and sign in with existing CC credentials.
2. Open **Manage college**.
3. Select or add a cohort.
4. Use **Create MC**, then **Add team** and choose its assigned Guide.
5. Use **Create player** within a team. Account editing supports deactivation and requires a replacement before disabling an assigned MC.

CCs cannot create other CCs, alter account roles, access another college, change college access status or grant Super Admin access. Those controls remain with Super Admin.

## MC workflow

1. Open the college’s own URL and sign in with the MC email/password.
2. Open **Manage players**.
3. Choose an assigned team and select **Create player**.

The server filters the MC's management snapshot to assigned teams and their players. It rechecks the active role and team assignment within the creation transaction. Removing the assignment removes creation access on the next request. Existing implicit `usr_mc01` assignments for original Alpha teams remain supported. Unassigned MCs see an empty state and must ask CC to assign a team.

## Data and permission safeguards

- College identity comes from the signed-in session, never submitted college IDs. Browser writes also carry the rendered college ID to reject stale tabs.
- College sessions and Super Admin sessions remain separate. Management operations validate the current active account and delegated permissions.
- CC and MC creation shares the existing transactional services with Super Admin. The older team/member API also enforces MC assignment and shares the cohort roster lock, preventing a bypass through another endpoint.
- Player roles are fixed server-side. Each team retains the five-player limit and distinct character slots; usernames remain unique within the college.
- Account and credential creation commit together. Retried management requests return the original result, and stale edits are rejected. Audits record the college, acting role and account result without recording passwords.
- Existing College for test accounts, credentials, team IDs, cohort IDs, saved work and assessment history remain in their existing database. No live accounts are created during verification; tests use disposable databases.

## Verification

Run `npm run test:management` for delegation, isolation, concurrency, revocation and history preservation. `npm run test:platform:http` covers both management APIs; pass the Playwright package root and Chrome executable to `scripts/check-platform-http.mjs` for desktop/mobile browser checks. `node scripts/check-day-one.mjs --all` runs the full disposable regression suite.

Local verification on 19 November 2026 passed 338 regression tests and 101 HTTP/browser checks, with no browser errors or mobile overflow. The focused delegation fixture additionally verifies revoked-assignment replay and concurrent removal of CCs with different home cohorts. A read-only BSON comparison of all 88 existing College for test collections found no changed documents; its 29 users and 29 credentials remain intact. No deployment to Vercel is included in this local release.

