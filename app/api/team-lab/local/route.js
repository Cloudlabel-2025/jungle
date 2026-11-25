import { connect, models } from "@/lib/db.js";
import { tenancyEnabled, runWithCollege } from "@/lib/college-context.js";
import { contextForCollege } from "@/lib/college-registry.js";
import { authenticateLocalGrant } from "@/lib/team-lab-local-grants.js";
import { saveTeamLab } from "@/lib/team-lab.js";
import { boundedJson } from "@/lib/request-body.js";
import { allowedWriteOrigin } from "@/lib/request-origin.js";
async function handle(request) {
  const respond = (data, status = 200) =>
    Response.json(data, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  try {
    if (!allowedWriteOrigin(request, null))
      throw Object.assign(
        Error("Cross-origin local connections are not allowed."),
        { status: 403 },
      );
    const url = new URL(request.url),
      authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer "))
      throw Object.assign(
        Error("A project-only local connection is required."),
        { status: 401 },
      );
    const execute = async () => {
      await connect();
      const auth = await authenticateLocalGrant(
        url.searchParams.get("grantId"),
        authorization.slice(7),
      );
      if (request.method === "GET") {
        if (url.searchParams.has("version")) {
          const known = Number(url.searchParams.get("version"));
          if (!Number.isSafeInteger(known) || known < 0)
            throw Object.assign(Error("Invalid project version."), {
              status: 400,
            });
          const revision = await models.TeamLab.findById(auth.projectId)
            .select("version")
            .lean();
          if (revision?.version === known)
            return respond({ projectId: auth.projectId, version: known });
        }
        const project = await models.TeamLab.findById(auth.projectId)
          .select("files version")
          .lean();
        if (!project)
          throw Object.assign(
            Error(
              "Open your team project in the game before connecting local code.",
            ),
            { status: 404 },
          );
        return respond({
          projectId: auth.projectId,
          version: project.version,
          files: Object.fromEntries(
            project.files.map((f) => [f.path, f.content ?? ""]),
          ),
        });
      }
      const body = await boundedJson(request, 1250000);
      if (body.projectId !== auth.projectId || body.action)
        throw Object.assign(
          Error("This connection only syncs its assigned team source."),
          { status: 403 },
        );
      return respond(await saveTeamLab(auth.user, body));
    };
    if (tenancyEnabled()) {
      const collegeId = url.searchParams.get("collegeId");
      if (!collegeId || collegeId.length > 100)
        throw Object.assign(Error("A college connection is required."), {
          status: 401,
        });
      return await runWithCollege(
        await contextForCollege({ _id: collegeId }),
        execute,
      );
    }
    return await execute();
  } catch (e) {
    return respond(
      {
        error: e.status
          ? e.message
          : "The local connection could not reach project storage.",
      },
      e.status || 503,
    );
  }
}
export const GET = handle;
export const POST = handle;
