import { collegeRoute } from "@/lib/college-request.js";
import { currentUser } from "@/lib/auth.js";
import { allowedWriteOrigin } from "@/lib/request-origin.js";
import { boundedJson } from "@/lib/request-body.js";
import {
  createLocalGrant,
  listLocalGrants,
  revokeLocalGrant,
} from "@/lib/team-lab-local-grants.js";
import { requestOrigin } from "@/lib/college-routing.js";
import {
  readTeamLab,
  saveTeamLab,
  heartbeatTeamLab,
  listTeamLabs,
  reviewTeamLab,
} from "@/lib/team-lab.js";

async function handle(request) {
  try {
    if (request.method !== "GET" && !allowedWriteOrigin(request, null))
      throw Object.assign(new Error("Cross-origin writes are not allowed."), {
        status: 403,
      });
    const actor = await currentUser();
    if (!actor || actor.mustChangePassword)
      throw Object.assign(
        new Error("Please sign in with your permanent password."),
        { status: 401 },
      );
    let result;
    if (request.method === "GET") {
      const q = new URL(request.url).searchParams;
      const options = {};
      options.teamId = q.get("teamId") || undefined;
      for (const key of ["version", "revision"])
        if (q.has(key)) {
          const n = Number(q.get(key));
          if (!Number.isSafeInteger(n) || n < 0)
            throw Object.assign(new Error("Invalid version."), { status: 400 });
          options[key] = n;
        }
      result =
        q.get("view") === "local-connections"
          ? await listLocalGrants(actor)
          : q.get("view") === "teams"
            ? await listTeamLabs(actor)
            : await readTeamLab(actor, options);
    } else {
      const body = await boundedJson(request, 1250000);
      result =
        body.action === "local-connect"
          ? await createLocalGrant(
              actor,
              body,
              requestOrigin(request.headers, request.url),
            )
          : body.action === "local-disconnect"
            ? await revokeLocalGrant(actor, body)
            : body.action === "review"
              ? await reviewTeamLab(actor, body)
              : body.action === "presence"
                ? await heartbeatTeamLab(actor, body)
                : await saveTeamLab(actor, body);
    }
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    if (!e.status) console.error("Team lab request failed", e);
    return Response.json(
      {
        error: e.status
          ? e.message
          : "Team lab is temporarily unavailable. Your draft is retained.",
      },
      {
        status: e.status || 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
export const GET = collegeRoute(handle);
export const POST = collegeRoute(handle);
