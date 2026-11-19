# College tenancy implementation verification

Completed 19 November 2026.

## Existing installation

- Registered college: **College for test**.
- Sign-in code: **college-for-test**.
- Existing application database remains **codewild**; no database rename or learner reassignment occurred.
- **87 collections and 29 users** preserved.
- Source collection contents and indexes backed up and successfully restored into a disposable database.
- All non-cohort collection hashes and index definitions matched the backup after adoption.
- The cohort collection matched its backup after changing only the college label to College for test. Alpha Cohort 2026 and its ID remain unchanged.
- Credentials, private bytes, learning records and issued report files were not rewritten.
- The temporary Atlas restore database was removed after verification. The private backup and adoption proof remain under ignored `.data/college-backups/1795065616239-c024c1f0-64ee-44f8-a938-89918a0fcfc1/`.
- Local `.env.local` now enables TENANCY_ENABLED. Runtime context selection was verified against the registered college and all 29 existing accounts.

The Atlas deployment enforces a 38-byte database-name limit. Generated college and rehearsal names were shortened to 36 and 35 ASCII bytes respectively after identifying that restriction.

## Engineering checks

| Check | Result |
| --- | --- |
| Full disposable regression suite | 335 passed, zero failed or skipped |
| Final focused college isolation/adoption test | Passed, including preserved collection settings, failed-provisioning recovery and Atlas-compatible names |
| Production build with tenant mode enabled | Passed |
| Final production HTTP integration | 43 checks passed across two synthetic colleges and Gamer/MC/CC roles |
| Patch whitespace verification | Passed |

The HTTP checks cover college selection, repeated local identities, scoped state, server-rendered pages, private file bytes, isolated mutation, stale-tab conflicts, old session rejection, warm-connection suspension, sign-in recovery and logout. Existing single-college preview launchers explicitly disable tenancy for their isolated fixtures; they do not use the live registry.

## Operational scope

The initial tenancy release provided college creation, listing and lifecycle changes through the local operator CLI. The subsequent [super admin dashboard](super-admin.md) now adds browser-based college, cohort, staff and team management at `/platform`. Existing cohort/team permissions are preserved; global identity, multi-cohort staff switching and self-service signup remain separate extensions. Existing sessions require a fresh sign-in. This work enables the local installation and adopts its configured database; it does not deploy the application to a hosted environment or certify hosted capacity.

See [college tenancy operations](college-tenancy-operations.md) for configuration, provisioning and rollout.

## Dedicated college URLs

The URL update passed an isolated production build, routing unit checks, account-recovery and CC/MC permission fixtures, 121 CMS HTTP/browser checks, 43 college HTTP checks and 52 portal HTTP/browser checks. The portal checks use two synthetic colleges with repeated account IDs and verify host-bound login for all three roles, independent browser tabs, incoming-header spoof rejection, cross-college login/recovery rejection, the hosted path fallback and desktop/mobile login. Captured recovery mail resets only the intended college's account; historical BSON digests remain unchanged. These checks do not use or migrate the existing College for test database.

Run `npm run test:portals` for routing checks and `npm run test:portals:http` against a completed build for the synthetic HTTP suite. The latter accepts optional Playwright runtime and Chrome executable paths to include browser checks. An isolated verification build uses `CODEWILD_BUILD_CHECK=1`; set the same variable when starting its HTTP checks.
