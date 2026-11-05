import { currentUser } from "@/lib/auth.js";
import { boundedJson } from "@/lib/request-body.js";
import { allowedWriteOrigin } from "@/lib/request-origin.js";
import { pilotAction } from "@/lib/pilot-engine.js";
import { authorisedFile, bytesFor } from "@/lib/pilot-storage.js";
import { parseCsv, workbookCsv, csv } from "@/lib/pilot-assessment.js";
import { models, connect } from "@/lib/db.js";
import { cohortOf, demand, permitted } from "@/lib/access-scope.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request) {
  try {
    demand(allowedWriteOrigin(request), "Cross-origin marks return denied.");
    const u = await currentUser();
    demand(u, "Please sign in.", 401);
    const body = await boundedJson(request, 10000),
      file = await authorisedFile(u, body.evidenceId);
    demand(file.state === "RETURN" && file.data.batchId === body.batchId);
    const bytes = await bytesFor(file),
      rows = parseCsv(
        file.data.filename.toLowerCase().endsWith(".xlsx")
          ? workbookCsv(bytes)
          : bytes.toString("utf8"),
      );
    return Response.json(
      await pilotAction(u, "import", {
        requestId: body.requestId,
        batchId: body.batchId,
        rows,
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 400 });
  }
}
export async function GET(request) {
  try {
    const u = await currentUser();
    demand(u, "Please sign in.", 401);
    demand(
      ["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(u.role) &&
        permitted(u, "sprint:write"),
    );
    await connect();
    const id = new URL(request.url).searchParams.get("id"),
      b = await models.PilotBatch.findOne({
        _id: id,
        cohortId: cohortOf(u),
      }).lean();
    demand(b && (u.role === "CENTRE_COMMAND" || b.userId === u._id));
    const s = await models.PilotSprint.findById(b.sprintId).lean();
    demand(
      s &&
        b.data.rows.every((r) =>
          s.data.teams.some(
            (t) =>
              t.teamId === r.teamId &&
              (u.role === "CENTRE_COMMAND" || t.commanderId === u._id),
          ),
        ),
    );
    const columns = [
      "key",
      "cohort_id",
      "sprint_id",
      "gamer_id",
      "task_id",
      ...b.data.rubric.map((c) => c.key),
      "total_score",
      "rationale",
      "review_flag",
    ];
    const rows = b.data.rows.map((r) => ({
      key: r.key,
      cohort_id: b.cohortId,
      sprint_id: b.sprintId,
      gamer_id: r.userId,
      task_id: r.taskId,
      review_flag: "true",
    }));
    const bundle = {
      batchId: b._id,
      prompt: b.data.prompt,
      promptVersion: b.data.promptVersion,
      rubricId: b.data.rubricId,
      rubric: b.data.rubric,
      evidence: b.data.rows,
      returnCsv: csv(rows, columns),
      instructions:
        "External AI suggestions only. Human review required before marks can commit.",
    };
    return Response.json(bundle, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="assessment-${b._id}.json"`,
      },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 400 });
  }
}
