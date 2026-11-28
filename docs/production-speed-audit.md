# Production speed audit — November 28, 2026

Target: https://voyageofwilderness-vow.vercel.app. Measurements used ordinary HTTP requests from the operator's machine without a browser or authenticated player session. Database checks used read-only native-driver queries with automatic collection/index creation disabled.

## Observed response times

| Request | First sample | Following samples |
| --- | ---: | ---: |
| Health | 1,015 ms | 518 / 560 ms |
| College entry | 370 ms | 403 / 406 ms |
| CHC portal (`/c/chc`) | 4,146 ms | 616 / 598 ms |
| Anonymous session check | 360 ms | 720 / 314 ms |

Times include downloading the response body, not just receiving headers. CHC streamed headers in 389 ms on its first sample but finished the body after 4,146 ms. This shows a slow initial server response stream; it does not isolate connection setup from other server work or prove a function cold start.

## Confirmed deployment mismatch and change

Production responses identify the serving function as `iad1`. MongoDB's `hello` response identifies both the registry and CHC tenant as AWS `AP_SOUTH_1`. The function and database are therefore in different regions.

`vercel.json` now specifies `"regions": ["bom1"]`, placing new deployments in Mumbai alongside the database. This change requires a new deployment; it does not move the existing deployment. Vercel documents [region identifiers](https://vercel.com/docs/regions) and the [project region setting](https://vercel.com/docs/project-configuration/vercel-json#regions). No database migration is needed.

The local database connection took 4,519 ms to establish; subsequent local pings took 89–107 ms and tenant player reads took 99–108 ms. These measurements describe the operator-to-Atlas path, not Vercel-to-Atlas latency.

## Other findings

- All 23 unique JS/CSS assets referenced by the combined college-entry and CHC portal markup returned 200. Their cache headers were immutable; larger assets used Brotli. Missing assets or disabled compression were not observed.
- Those assets contain 626,792 bytes of decoded CSS and 753,857 bytes of decoded JavaScript. These are combined decoded totals, not compressed transfer sizes or browser execution measurements. The root layout imports styles for all game and staff screens, leaving an opportunity to split styles by route.
- Code inspection shows the API wrapper reads account status and password-change status, then `currentUser()` reads the account and password-change status again. Snapshot access checks perform a further user read. These add database work, especially across regions. Any future consolidation must remain request-scoped and preserve account revocation, tenant isolation, password enforcement and transaction-time checks.
- Signed-in dashboard API latency, rendering, input responsiveness and classroom concurrency were not measured in this unauthenticated production audit. No player records or credentials were changed.

After deploying the region change, repeat the same public probes and verify the function identifier contains `bom1` rather than `iad1`. Compare several samples; a single fast health request does not establish dashboard performance.
