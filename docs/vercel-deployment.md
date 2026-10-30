# Deploy Jungle to Vercel

The app already uses Mongoose and MongoDB transactions. Use MongoDB Atlas; the local development MongoDB process cannot run inside a Vercel Function.

## 1. Configure Atlas and initialize the database

Use a URI with an explicit application database:

```text
mongodb+srv://<username>:<password>@<cluster-host>/codewild?retryWrites=true&w=majority
```

Keep the real URI only in `.env.local` and Vercel environment variables. Never use a `NEXT_PUBLIC_` prefix for database credentials or the session secret. `.env.local` is ignored by Git.

In Atlas, grant the database user read/write access to `codewild`. Configure **Network Access** to allow your local connection and the deployment's outbound connections. Atlas only accepts connections from its IP access list. Vercel outbound addresses depend on your networking configuration; use static outbound IPs when available. An allow-all entry (`0.0.0.0/0`) permits connections from anywhere and should only be used with that exposure understood and strong database credentials.

Run locally against the configured Atlas database:

```sh
npm run db:check
npm run seed
```

On this Windows environment, Node needs the Windows certificate authorities to connect to Atlas. Before the commands above or `npm run dev`, run this in the same PowerShell window:

```powershell
$env:NODE_OPTIONS = "--use-system-ca"
```

This keeps certificate verification enabled. The Vercel deployment uses its own trust store; do not disable TLS verification to resolve local certificate errors.

The check performs a ping and a read inside a transaction without modifying records. Seeding creates missing initial records and integrity indexes without resetting existing records. It does not transfer local gameplay history. For existing local records, use a separate MongoDB backup/restore process rather than reseeding as a migration.

## 2. Import the repository

Push the prepared changes to `Cloudlabel-2025/jungle`, then open [Vercel New Project](https://vercel.com/new) and import that repository.

- Framework: **Next.js**.
- Root directory: repository root (`./`).
- Node.js: **22.x**, pinned by `package.json`.
- Build command: **npm run build**, supplied by `vercel.json`.
- Keep the default output directory and installation settings.

Do not use a static export, custom start command, or `npm run dev` on Vercel. The API already uses the Node.js runtime, with a cached MongoDB connection and a bounded connection pool per instance. Database seeding is an operator step, never part of the Vercel build.

## 3. Add environment variables before deploying

| Variable | Production value |
| --- | --- |
| `MONGODB_URI` | The Atlas URI including `/codewild` |
| `SESSION_SECRET` | Copy the generated local secret from `.env.local`, or generate a different random secret of at least 32 characters |
| `DEMO_MODE` | `false` for individual password login |
| `APP_ORIGIN` | The exact HTTPS site origin, such as `https://your-project.vercel.app`, with no trailing slash |

If the final domain is unknown during import, initially omit `APP_ORIGIN`: the API accepts same-origin writes using the serving Host and proxy protocol. `APP_ORIGIN` adds an explicitly trusted public origin for proxies that retain an internal Host; it does not prevent same-origin requests on preview or custom domains. Once Vercel assigns the production domain, set `APP_ORIGIN` to that HTTPS origin and redeploy. Do not copy the local `http://127.0.0.1:3000` value into Vercel.

Use a separate Atlas database and session secret for Preview deployments. Leave `APP_ORIGIN` unset in Preview unless a proxy requires an explicit public origin. Changing preview URLs support same-origin login automatically.

Production password login requires provisioning credentials for the seeded users. The existing `scripts/provision-account.mjs` accepts a JSON object containing `email` and `password` through secure standard input; run it with `node --env-file-if-exists=.env.local scripts/provision-account.mjs`. See the account provisioning instructions in `artifacts/campus-v2-handover.md`. Do not put passwords in shell arguments, Git, or public files.

For an intentionally private persona simulation, use `DEMO_MODE=true` plus a strong `DEMO_ACCESS_CODE` and deployment access restrictions instead. Local persona access does not automatically enable production persona access.

## 4. Verify the deployment

Open the assigned HTTPS URL, sign in with a provisioned account, and confirm that saved data survives reloads. A successful build alone does not verify runtime database access. If requests fail, run `npm run db:check` locally and inspect Vercel runtime logs and the Atlas IP access list.

Environment variable changes apply to a new deployment; redeploy after updating them. Rotate any database password that has been shared in chat before publishing.

References: [Vercel environment variables](https://vercel.com/docs/environment-variables), [supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
