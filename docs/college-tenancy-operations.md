# College tenancy operations

Jungle uses a platform registry and a separate logical MongoDB database for each college. Databases may share a cluster. Each college URL resolves its registered college and immutable ID; users enter only their username/email and password. Cohort, team, staff and learner permissions continue inside that database.

The main address opens the **`/platform` super admin dashboard**. College lifecycle management is also available through the local operator CLI. The dashboard uses separate platform credentials and sessions. A college's Centre Command account cannot provision or open another college. Multi-cohort staff switching, shared identities across colleges and individual custom domains are future extensions; current accounts keep their existing single-cohort assignment. See [super admin access and management](super-admin.md).

## Configuration

| Variable | Meaning |
| --- | --- |
| TENANCY_ENABLED | Set to true only after registering the existing database |
| MONGODB_URI | Existing database connection, retained for College for test |
| MASTER_MONGODB_URI | Optional registry cluster connection; falls back to MONGODB_URI |
| MASTER_DB_NAME | Registry database, default jungle_platform |
| TENANT_MONGODB_URI | Optional connection for newly provisioned colleges; falls back to MONGODB_URI |
| COLLEGE_CONNECTION_LIMIT | Maximum cached college connections per process, default 50 |
| COLLEGE_OPERATOR | Operator attribution for CLI audit entries |
| COLLEGE_ROOT_DOMAIN | Optional shared hostname for college subdomains; omit for hosted `/c/<slug>` URLs |

The registry stores database names and connection profile references, not raw connection credentials. Keep environment files private. A database pool has at most five connections per college per process. The cache refuses new entries at its configured limit rather than evicting a connection that might be in use. Size this limit for deployment concurrency; recycle idle application instances when retiring connections. This initial bounded cache does not automatically reclaim idle college entries.

Generated college database names are 36 ASCII bytes and rehearsal names are 35 bytes, within the 38-byte limit enforced by the current Atlas deployment. College display names and codes are independent of database names.

With tenancy disabled, existing single-database test fixtures and preview tools retain their original behavior. Production must keep tenancy enabled after adoption. Demo persona login is disabled in tenant mode, regardless of DEMO_MODE.

## Adopt the existing database

Stop application and worker writes before adoption. Run from the repository root:

```powershell
node --use-system-ca --env-file=.env.local scripts/colleges.mjs adopt --writers-stopped
```

The command inventories every ordinary collection and its indexes, saves BSON files and a SHA-256 manifest under ignored `.data/college-backups/`, restores the backup into a uniquely named temporary database, verifies the restored collection contents/indexes, then removes that temporary database. Backup verification must succeed before adoption. Allow enough storage and database permissions for that rehearsal. The backup includes credential hashes and private files: protect it as private institutional data and apply the approved retention policy.

The registry maps **College for test**, code **college-for-test**, to the current database without renaming it. Existing document IDs, learner accounts, password hashes, work, marks, private files and issued PDFs stay intact. Cohort.college is updated to College for test; the prior values and inventory are recorded in PlatformAudit. Issued PDF bytes and historical report snapshots are not rewritten. Existing user-only sessions become invalid and require a fresh login.

The adoption command is idempotent for an already active mapping. A failure after registry creation leaves MAINTENANCE; rerun after fixing the problem to take a fresh verified backup and finish. A mapping to another database is rejected. A failed restore leaves its temporary database for investigation and does not adopt the source.

After success, set TENANCY_ENABLED=true in the application and worker environment and restart them. Never point a college at jungle_platform. The runtime rejects registry/database collisions. An old application version must not be run alongside the college-aware runtime during cutover.

## List and manage colleges

```powershell
node --use-system-ca --env-file=.env.local scripts/colleges.mjs list
node --use-system-ca --env-file=.env.local scripts/colleges.mjs status college-for-test SUSPENDED
node --use-system-ca --env-file=.env.local scripts/colleges.mjs status college-for-test ACTIVE
```

Status changes increment accessRevision and invalidate existing sessions. Cached database connections do not bypass registry status checks. Signing out remains available for a suspended college. ACTIVE, SUSPENDED, MAINTENANCE and ARCHIVED are supported operator statuses; incomplete provisioning cannot be activated through this command.

To create a college, run `scripts/colleges.mjs create` with a JSON object on secure standard input. Required fields are name, slug, adminName, email, password and startDate (YYYY-MM-DD). username is optional. Passwords must not be placed in shell arguments or source control. The command creates an initial Alpha cohort and a credentialed Centre Command account; it does not seed fictional teams, learners or learning outcomes. A failed provisioning operation can be retried by supplying the same college code and corrected input. Retrying resumes the allocated database; it does not publish partially provisioned colleges.

## Sign in and switch colleges

Open the URL shown in the college overview using **Open college** or **Copy URL**. College for test uses `http://college-for-test.localhost:3000/` locally. Users enter their username/email and password; the college name is fixed by the address. Login rotates the session and reloads the workspace, disposing of in-memory work queues. Accounts with identical usernames/emails in different colleges remain independent.

The session carries the immutable college ID and registry access revision. Browser API calls include the college bound to the rendered page. A session belonging to another college receives a conflict. The server derives the college from a registered URL and removes incoming selection headers. Subdomain sessions use host-only cookies, supporting independent college tabs. The `/c/<slug>` fallback uses a host-wide selection cookie; save work and sign out before switching fallback colleges in the same browser.

On Vercel without wildcard domain configuration, the college URL is `https://<deployment-host>/c/college-for-test`. To use `https://<college-slug>.<your-domain>/`, configure the root and wildcard domain in your hosting provider, its required DNS records and TLS, then set `COLLEGE_ROOT_DOMAIN=<your-domain>` and redeploy. Keep `CMS_PUBLIC_ORIGIN` set to the public CMS origin for recovery mail. Individual college subdomains are not automatically provisioned at your DNS provider by the application.

## Operator scripts and workers

Unscoped model access fails in tenant mode. Execute a single-college script explicitly:

```powershell
node --use-system-ca --env-file=.env.local scripts/in-college.mjs college-for-test scripts/provision-account.mjs
```

The underlying script retains its existing secure stdin contract. Review its purpose before running resets or migrations. Do not run the demo seeder inside a real college. `npm run dev` skips demo seeding when tenancy is enabled.

Attendance and pilot processing enumerate ACTIVE colleges, take separate distributed leases per college/job and execute within isolated contexts. Each college's failure is reported independently. The authenticated pilot cron endpoint retains its existing CRON_SECRET protection. The CLI dispatcher and registry need access to the eligible college databases; a platform connection alone is not an institutional data authorization boundary.

Notification contact configuration is now nested by immutable college ID and cohort ID: `{"<college-id>":{"alpha":[{"name":"Approved contact","email":"approved@example.org","approval":"Institution-approved reference"}]}}`. Legacy cohort-only contact lists are not reused in tenant mode. College ID also prefixes external delivery idempotency keys and new private Blob object paths. Existing object paths are preserved and still require college-local evidence authorization.

## Verification and rollout

```powershell
node scripts/check-day-one.mjs --all --test-file=college-tenancy.test.mjs
node scripts/check-day-one.mjs --all --test-concurrency=2
npm run build
node scripts/check-college-http.mjs
```

These checks use disposable databases. The HTTP check starts the production bundle with synthetic colleges and Gamer/MC/CC accounts, tests repeated IDs and private file downloads, checks server rendering, rejects stale-tab writes and legacy sessions, and verifies warm-connection suspension. It does not load the application environment file or certify production hosting capacity.

Before a hosted rollout, configure the registry and application secrets in that deployment, run the additive adoption against its explicitly chosen source, then verify authenticated HTTPS access, real private file delivery, scheduler operation and institutional backup recovery. Local activation does not deploy these changes to an existing hosted site. For rollback after writes resume, retain the current database and reconcile new work; do not overwrite it with an older backup.
