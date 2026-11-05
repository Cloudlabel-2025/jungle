import { get, head, issueSignedToken, presignUrl } from "@vercel/blob";
import { unzipSync, strFromU8 } from "three/examples/jsm/libs/fflate.module.js";
import { models, connect } from "./db.js";
import { scope, cohortOf, demand, permitted } from "./access-scope.js";
import { pilotAction, storageProof } from "./pilot-engine.js";
export const mime = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};
export async function authorisedFile(actor, id) {
  await connect();
  const { user } = await scope(actor),
    e = await models.PilotEvidence.findOne({
      _id: id,
      cohortId: cohortOf(user),
    }).lean();
  demand(e, "Evidence not found.", 404);
  if (e.data.batchId)
    demand(
      ["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(user.role) &&
        (user.role === "CENTRE_COMMAND"
          ? permitted(user, "sprint:write")
          : e.userId === user._id),
    );
  else {
    const s = await models.PilotSprint.findById(e.sprintId).lean(),
      t = s?.data.teams.find((t) => t.teamId === e.teamId);
    demand(
      t &&
        ((user.role === "CENTRE_COMMAND" &&
          (permitted(user, "sprint:write") ||
            permitted(user, "reports:read"))) ||
          (user.role === "MISSION_COMMANDER" && t.commanderId === user._id) ||
          (user.role === "GAMER" && t.members.includes(user._id))),
    );
  }
  return e;
}
export async function uploadIntent(user, b) {
  demand(
    process.env.BLOB_READ_WRITE_TOKEN,
    "Private file storage is not configured.",
    503,
  );
  const out = await pilotAction(user, "upload-intent", b),
    ext = b.filename.split(".").at(-1).toLowerCase(),
    validUntil = Date.now() + 15 * 60000,
    options = {
      pathname: out.path,
      operations: ["put"],
      validUntil,
      allowedContentTypes: [mime[ext]],
      maximumSizeInBytes: 5 * 1024 * 1024,
    };
  const token = await issueSignedToken(options),
    signed = await presignUrl(token, {
      operation: "put",
      pathname: out.path,
      access: "private",
      validUntil,
      allowedContentTypes: [mime[ext]],
      maximumSizeInBytes: 5 * 1024 * 1024,
      allowOverwrite: false,
      addRandomSuffix: false,
    });
  return { ...out, uploadUrl: signed.presignedUrl, contentType: mime[ext] };
}
export async function bytesFor(e) {
  const r = await get(e.data.path, { access: "private" });
  demand(r?.statusCode === 200, "Private object unavailable.", 404);
  const reader = r.stream.getReader(),
    chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 5 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Object exceeds 5 MB.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function finishUpload(user, b) {
  const e = await authorisedFile(user, b.evidenceId);
  demand(e.userId === user._id && e.state === "PENDING");
  const info = await head(e.data.path);
  demand(
    info.size <= 5 * 1024 * 1024 && info.size > 0,
    "Upload at most 5 MB.",
    400,
  );
  const bytes = await bytesFor(e),
    ext = e.data.filename.split(".").at(-1).toLowerCase();
  demand(
    info.contentType === mime[ext] && bytes.length === info.size,
    "Uploaded type or size does not match the reserved object.",
    400,
  );
  const { extracted, warning } = inspectEvidence(bytes, ext);
  return pilotAction(user, "upload-complete", {
    requestId: `upload-complete:${e._id}`,
    evidenceId: e._id,
    path: e.data.path,
    size: info.size,
    contentType: info.contentType,
    etag: info.etag,
    blobUrl: info.url,
    extracted,
    warning,
    _proof: storageProof,
  });
}
export function inspectEvidence(bytes, ext) {
  demand(
    bytes.length > 0 && bytes.length <= 5 * 1024 * 1024,
    "Upload at most 5 MB.",
    400,
  );
  demand(Object.hasOwn(mime, ext), "Unsupported evidence format.", 400);
  let extracted = "",
    warning =
      "Human review of original file and executable evidence is required.";
  if (ext === "pdf")
    demand(
      bytes.subarray(0, 5).toString() === "%PDF-",
      "Invalid PDF signature.",
      400,
    );
  if (["docx", "xlsx"].includes(ext)) {
    let total = 0;
    const zip = unzipSync(bytes, {
        filter: (f) => {
          total += f.originalSize;
          demand(
            total < 30 * 1024 * 1024 && f.originalSize < 10 * 1024 * 1024,
            "Office archive expands beyond limits.",
            400,
          );
          return true;
        },
      }),
      entry = ext === "docx" ? "word/document.xml" : "xl/workbook.xml";
    demand(zip[entry], "Wrong Office file type.", 400);
    if (ext === "docx")
      extracted = [
        ...strFromU8(zip[entry]).matchAll(
          /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g,
        ),
      ]
        .map((m) =>
          m[1]
            .replaceAll("&amp;", "&")
            .replaceAll("&lt;", "<")
            .replaceAll("&gt;", ">"),
        )
        .join(" ")
        .slice(0, 50000);
    warning =
      ext === "docx"
        ? "Text extracted; tables, layout and images need original-file review."
        : "Spreadsheet original retained; formulas and chart fidelity require human review.";
  }
  return { extracted, warning };
}
export async function fileDownload(actor, id) {
  const e = await authorisedFile(actor, id);
  demand(["READY", "RETURN"].includes(e.state), "Upload is not verified.", 409);
  const validUntil = Date.now() + 60000,
    token = await issueSignedToken({
      pathname: e.data.path,
      operations: ["get"],
      validUntil,
    }),
    signed = await presignUrl(token, {
      operation: "get",
      pathname: e.data.path,
      access: "private",
      validUntil,
      useCache: false,
    });
  return signed.presignedUrl;
}
