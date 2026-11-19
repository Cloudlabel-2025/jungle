# College tenant architecture and migration plan

Reviewed 19 November 2026. Status: proposed architecture and sequenced implementation plan. This review does not change application behavior or migrate database records.

Implementation update: the college isolation foundation and College for test adoption are now completed. See [implementation verification](college-tenancy-verification.md) and [operator instructions](college-tenancy-operations.md) for the delivered scope, preservation evidence and remaining extensions. The findings below describe the pre-conversion review.

Jungle will use each college as a tenant, with cohorts and teams inside the college. The existing installation will belong to **College for test**. Adopt its existing application database as the first college database so that existing identifiers, credentials, progress, evidence, results and audit history remain intact.

## Recommended structure

```text
Jungle platform
  Platform registry and platform administrators
  College for test [immutable college ID; slug: college-for-test]
    Existing application database
      Existing cohorts
        Teams
          Learners and assigned guides
      College-local accounts, credentials and operational history
  Another college
    Separate application database
      Its cohorts, teams, accounts and operational history
```

Use one platform registry database and one application database per college. Initially the databases may share the existing MongoDB cluster. This is a database boundary, not a claim of separate hardware, database credentials or capacity. Application database selection must always come from a trusted registry record. A shared application credential can still access several databases; dedicated credentials/clusters remain an option when institutional requirements justify them.

The name and slug are editable presentation/routing properties; an opaque immutable college ID owns the database mapping. A college rename must not rename its database or rewrite learner references. New database names derive from the immutable ID. The first college retains the existing database name.

### Why choose a database per college

| Option | Effect on Jungle | Decision |
| --- | --- | --- |
| Shared collections with collegeId on every document | Requires complete field backfill, query/aggregation/write enforcement and index changes, including records currently scoped indirectly through users or teams | Viable alternative, but not preferred for the first conversion |
| Separate database per college | Preserves existing local IDs and unique indexes; makes college backup and restore boundaries clear; requires connection-bound models, sessions and explicit runtime context | Recommended |

Neither option removes the need for cohort, team and person authorization. A connection to the correct college does not authorize access to every cohort in that college.

## Findings in Jungle

| Area | Current behavior | Required change |
| --- | --- | --- |
| `lib/db.js` | Models register on global Mongoose; one MONGODB_URI; transactions use mongoose.startSession() | Schema/model factory per connection; separate registry connection; transactions from the selected college connection |
| `lib/access-scope.js` | tenantOf() is actually a cohort filter; missing/null cohort is included for legacy alpha users | Rename to cohortFilter(); confine legacy compatibility to migrated data; enforce active college and assigned cohort before team rules |
| User and Credential | Users have one cohortId and role; email and username uniqueness are database-wide; credentials keyed by user ID | Keep accounts college-local; permit identical identities across colleges; add explicit cohort access assignments for staff |
| Cohort and Team | Cohort.college is a required display string; Team has cohortId | Registry becomes college identity authority; retain/audit display-string updates; verify team and staff assignments reference the same local cohort |
| `lib/auth.js`, `lib/session-token.js` | Session contains user ID, session ID and expiry, without college identity | Bind sessions to immutable college ID and session version; validate selected college, status and account on every request |
| API catch-all, pilot and storage routes | Resolve current user through global connection | Resolve and validate college before login, reads, mutations and file operations |
| Server layout | WorkspaceLayout calls currentUser() during server rendering | Apply the same tenant resolution to server rendering, redirects and API requests |
| Programme and storage | Cohort-scoped records include private bytes, upload reservations and deeply nested references | Keep all existing collections together in their college DB; retain team/owner/issuance checks; namespace external objects and signed proofs |
| Workers and scripts | Attendance/pilot workers and provisioning scripts operate against one connection; some scripts enumerate every user | Require a college for single-tenant tools; platform dispatcher enumerates eligible colleges and creates independent job contexts |
| Seeding | Alpha cohort seed hardcodes Titan Institute of Technology and inserts demonstration users/tasks | Separate college provisioning from synthetic demo seeding; new colleges start without fictional history |

Several documents lack cohortId and depend on ownership references or cohort-keyed IDs. This is another reason to preserve the complete application database rather than attempting a partial collection move.

## Registry and authorization model

The platform database contains:

- College: immutable ID, unique slug, display name, lifecycle status, database name, server-side connection profile reference, branding, schema version and access revision.
- CollegeDomain: exact verified hostname mapped to one college, reserved-name checks and verification status. Optional for the initial release.
- PlatformAdmin and its credentials/session records: separate from college accounts and existing CENTRE_COMMAND roles.
- PlatformAudit and provisioning/migration job records: actors, college ID, operation, state and timestamps. No passwords, private evidence or raw database connection strings in public responses.

College states are PROVISIONING, ACTIVE, MAINTENANCE, SUSPENDED, ARCHIVED and FAILED. Login and ordinary data access require ACTIVE. Provisioning/maintenance access uses a distinct operator context. Enforce unique database mappings to prevent two college records accidentally sharing the same database.

Within each college, CENTRE_COMMAND remains an operational role. Its existing cohort permissions are preserved. An explicit college-admin capability manages local cohorts and assignments; do not automatically elevate every existing CC to college administrator. Platform administrators manage college lifecycle and operator access; they do not inherit routine access to learner content. Any support access to college data must be explicit, time-bounded and audited.

Preserve User._id, password hash, role, teamId and current cohortId for existing accounts. Add a CohortMembership model keyed by userId and cohortId, with role, active status and optional scoped capabilities. Existing users receive one membership matching their current assignment. Staff may receive several cohort memberships; switching the active cohort must verify membership and rotate session context. For the first release, a learner has one active cohort; previous memberships and progress remain preserved. Admission to a subsequent cohort and balances across intakes need a separate enrollment policy before exposing that workflow.

The same email in two colleges represents two independent local accounts. Shared global identity and cross-college account switching are deferred. A person working at two colleges signs into the selected college independently.

## Request and database boundaries

1. Initial entry uses `/c/college-for-test` and a college selection/code entry on the root sign-in screen. The validated selection is recorded in a signed HttpOnly context cookie so existing role URLs and relative API calls can remain usable. It identifies the login target, not authorization. A later verified college subdomain can use the same resolver.
2. Resolve the selection against the registry. Never accept a request-provided database name or URI. Unknown, suspended or conflicting host/session college selections fail closed. No production default-college fallback on arbitrary requests.
3. Acquire a CollegeContext containing college ID, connection and connection-bound models. Credential lookup and account lockout are local to this database.
4. Issue a session containing collegeId, userId, sid, active cohort and access/session version. Revalidate current membership and lifecycle state. College switching clears account/session/browser state and requires login to the selected college.
5. Service functions receive the context explicitly. Prefer explicit dependency injection for this conversion; do not mutate a global currentTenant or swap globally registered models. A narrow adapter may be introduced only with demonstrated request isolation, never as silent fallback to the legacy DB.
6. Begin transactions through context.connection.startSession(). All participating models must use that connection. Platform provisioning uses a recoverable state machine because registry and application databases must not be treated as one atomic operation.
7. Apply existing cohort/team/owner checks and stronger same-cohort reference validation inside the selected database. Rename misleading tenantOf usages throughout the codebase and tests.

Connection/model caches must be keyed by immutable college ID plus connection configuration revision. Bound pool sizes and cache growth, deduplicate connection attempts, remove failed promises, and close only idle connections with no in-flight operations. Registry status must be revalidated even when a database connection is already cached. Do not copy Lims-V1's cached-connection early return as an authorization check.

Public catalog code and artwork may remain shared. Published configuration, progress, map layouts and private content remain college-local. Scope server cache keys, upload tokens, external Blob paths, notification destinations, logs and job keys by college. Include college/user/cohort in browser persistence keys and clear pending saves on logout/switch. Authenticated responses remain private and uncached; cached metadata must never reuse another college's branding or content.

## Reuse from Lims-V1

Reviewed `src/app/lib/master-db.js`, `tenant-db.js`, `tenant-resolver.js`, `tenant-cache.js`, `tenant-provisioning.js` and `src/app/models/master/Lab.js` in `D:/Projects/Lims-V1`.

Reuse the architectural patterns of a central registry, per-connection model factories, deduplicated connection creation, tenant provisioning states and normalized unique slugs. Adapt small utilities with attribution when implementation begins. Do not copy laboratory schemas, billing, subscriptions or demo defaults.

Strengthen the reference design in Jungle: validate registry status before using cached connections; bound connection lifetimes; verify proxy trust before honoring forwarded hosts; strip and set any internal tenant header at a trusted boundary instead of accepting browser-supplied headers; keep connection secrets behind server-only configuration; bind sessions to college identity. Lims-V1's request resolver accepts a designated internal header, so copying it requires proving that the deployment overwrites that header.

## Preserve existing data under College for test

Preferred migration is adoption of the current database, not a reset, reseed or copy to a newly named database.

1. Build a read-only inventory against the explicitly chosen source environment: every collection, index, count, cohort name/college label, ownership relationship, external object reference and private file hash. Identify any nonapplication/fixture collections. Do not infer the active database from seed files or print credentials.
2. Create and verify a restorable backup. Rehearse adoption on a disposable restored copy, including generated reports, upload parts, credentials and audit records. Capture a write-frozen baseline for final reconciliation.
3. Create the registry record with name College for test and slug college-for-test, mapping uniquely to the existing application's database. An immutable generated ID remains independent of this slug. Leave existing cohort and user IDs unchanged.
4. Add initial cohort memberships and migration metadata idempotently. Audit any required normalization. The college name displayed by the UI comes from the registry. If live Cohort.college differs, update that display field with its prior value recorded; preserve issued PDF bytes and historical report snapshots. No learner reassignment, reset, grading or password rotation is part of adoption.
5. Reconcile collections/counts, stable IDs, indexes, references, balances, scores, audit history and file hashes against the baseline. Expect only explicitly enumerated membership/metadata/display-label changes. Verify existing passwords through authorized login without exposing them.
6. During a controlled maintenance cutover, deploy the college-aware runtime and activate the registry mapping. Invalidate legacy sessions that lack collegeId. Require re-login; never reinterpret a user-only token in a different college database.
7. Enable the second synthetic college only after isolation tests pass. A rollback restores the matching application version and agreed metadata changes against the preserved database. Once writes resume, do not restore an old backup over new progress: reconcile those writes or roll forward.

The physical source database and its actual cohort labels have not been inspected during this code review. The adoption inventory must confirm that the selected database contains only the intended existing installation. Any ambiguous ownership blocks automatic movement.

## Implementation sequence and exit criteria

| Phase | Deliverable | Required evidence |
| --- | --- | --- |
| 1 | Registry schemas, connection/model factories, CollegeContext and transaction helper | Two disposable college DBs with identical local IDs; concurrent operations stay isolated; registry data is never returned by a college model |
| 2 | College entry, login/session binding, server layout and all API boundary conversion | Same username/password can be tested independently in two colleges; forged college headers, conflicting selections and legacy tokens fail; suspension blocks warm connections |
| 3 | All business services, memberships, files, cache keys, notifications and workers converted | Existing regression suite passes per college; cross-cohort/team checks pass; jobs cannot run without an explicit tenant context |
| 4 | Platform college management and minimal local cohort administration | Authorized operator can provision, activate and suspend an empty college; ordinary CC cannot access platform controls |
| 5 | Read-only inventory, idempotent adoption tool, backup/restore rehearsal and College for test cutover pack | Preserved credentials/history/file hashes and recorded permitted changes; tested cutover and rollback procedures |
| 6 | Full two-college role and storage UAT | Concurrent Gamer/MC/CC journeys; no cross-college reads/writes/downloads; tenant job failure does not stop another college; production runtime and pool behavior measured |

New college provisioning creates the database, indexes, approved configuration and an initial admin through a recoverable idempotent operation. It must not seed Alpha's fictional learners, scores or tasks. Provisioning failures leave a visible FAILED state and a retryable record; no active college is published until its checks pass.

Each worker dispatches bounded work per eligible college with independent leases, retries and failures. Provisioning, reset, migration, export and backup commands require explicit college selection and environment. Destructive commands must identify their target; remove every legacy implicit all-user path before multi-college operation.

Minimum isolation tests cover list/detail/search/export/audit endpoints, direct IDs, aggregation and bulk writes, uploads and completion retries, signed file access, generated report issuance, browser persistence, concurrent SSR/API requests, tenant suspension, cohort switching, worker leases and restore of one college without altering another. Tests deliberately reuse local user, cohort, team and evidence IDs across the two college databases.

## Scope and next step

Begin with Phase 1 on disposable databases and then convert the request/authentication boundaries. Keep the current installation available until the complete cutover gate is met. College display name is confirmed as **College for test**. Production domain and database target are deployment decisions, not prerequisites for writing the foundation.

Defer subscriptions, billing, public self-service onboarding, cross-college rankings, global learner identity and custom-domain automation. Resume the existing feature backlog after college isolation and data adoption are verified.
