import { get, head, issueSignedToken, presignUrl } from "@vercel/blob";
import { unzipSync, strFromU8 } from "three/examples/jsm/libs/fflate.module.js";
import { models, connect, transaction } from "./db.js";
import { scope, cohortOf, demand, permitted } from "./access-scope.js";
import { pilotAction, storageProof, reportSourceDigest } from "./pilot-engine.js";
import { createHash } from "node:crypto";
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
  if (e.data.reportKind) {
    const sprint = await models.PilotSprint.findOne({
      _id: e.sprintId, cohortId: cohortOf(user),
    }).lean();
    const team = sprint?.data.teams.find((item) => item.teamId === e.teamId);
    demand(team && team.members.includes(e.data.reportUserId));
    if (user.role === "GAMER") {
      demand(user._id === e.data.reportUserId);
      const issued = await models.PilotDaily.findOne({
        _id: `${e.sprintId}:private-final-report:${user._id}`,
        cohortId: cohortOf(user), teamId: e.teamId, state: "FINAL_REPORT_ISSUED",
      }).lean();
      demand(
        issued && [issued.data.passportId, issued.data.certificateId].includes(e._id) &&
          sprint.data.acceptances.some((record) =>
            record.teamId === team.teamId && record.decision === "ACCEPTED" && record.key === "Key 5"),
      );
      if (issued.data.sourceDigest) demand(issued.data.sourceDigest === await reportSourceDigest({
        cohortId: cohortOf(user), session: null, s: sprint, t: team, u: user,
      }, user._id), "The report evidence changed; staff must regenerate and reissue the documents.", 409);
    } else {
      demand(
        (user.role === "CENTRE_COMMAND" &&
          (permitted(user, "sprint:write") || permitted(user, "reports:read"))) ||
        (user.role === "MISSION_COMMANDER" && team.commanderId === user._id),
      );
    }
  } else if (e.data.batchId)
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
  const out = await pilotAction(user, "upload-intent", b),
    ext = b.filename.split(".").at(-1).toLowerCase();
  if (out.provider === "MONGODB") return { ...out, chunkSize: 1024 * 1024,
    uploadUrl: `/api/pilot/storage?evidenceId=${encodeURIComponent(out.evidenceId)}`, contentType: mime[ext] };
  const
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
export async function storePrivateUpload(actor, id, request) {
  const evidence = await authorisedFile(actor, id);
  demand(evidence.userId === actor._id && evidence.state === "PENDING" && evidence.data.provider === "MONGODB");
  demand(Date.now() - new Date(evidence.createdAt).getTime() <= 15 * 60000, "Upload reservation expired. Create a new upload.", 409);
  const ext = evidence.data.filename.split(".").at(-1).toLowerCase();
  demand(request.headers.get("Content-Type") === mime[ext], "Uploaded type does not match the reserved file.", 400);
  const chunked = request.headers.has("X-Upload-Part"), chunkSize = 1024 * 1024;
  const part = Number(request.headers.get("X-Upload-Part")), count = Number(request.headers.get("X-Upload-Parts")),
    totalSize = Number(request.headers.get("X-Upload-Size"));
  if (chunked) demand(Number.isInteger(part) && Number.isInteger(count) && Number.isInteger(totalSize) &&
    totalSize > 0 && totalSize <= 5 * chunkSize && count === Math.ceil(totalSize / chunkSize) && part >= 0 && part < count,
    "Invalid bounded upload parts.", 400);
  const reader = request.body?.getReader();
  demand(reader, "File bytes required.", 400);
  const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > (chunked ? chunkSize : 5 * chunkSize)) { await reader.cancel(); demand(false, "Upload at most 5 MB using parts of at most 1 MB.", 413); }
    chunks.push(value);
  }
  const uploadedBytes = Buffer.concat(chunks), uploadedSize = size;
  if (chunked) demand(size === Math.min(chunkSize, totalSize - part * chunkSize), "Upload part size does not match its reservation.", 400);
  else inspectEvidence(uploadedBytes, ext);
  return transaction(async session => {
    let bytes = uploadedBytes, size = uploadedSize;
    const { user } = await scope(actor, session);
    const current = await models.PilotEvidence.findOne({ _id: id, cohortId: cohortOf(user), userId: user._id,
      state: "PENDING", "data.provider": "MONGODB" }).session(session).lean();
    demand(current, "The upload is no longer pending.", 409);
    const stored = await models.PrivateReportFile.exists({ _id: id }).session(session);
    if (chunked && stored) return { evidenceId: id, stored: true };
    demand(!stored, "This upload is already stored; complete it instead of overwriting it.", 409);
    if (chunked) {
      const plan = current.data.uploadParts;
      demand(!plan || (plan.count === count && plan.totalSize === totalSize), "Upload part declaration changed.", 409);
      const partId = `${id}:part:${part}`, partHash = createHash("sha256").update(bytes).digest("hex");
      const previous = await models.PrivateReportFile.findById(partId).session(session).lean();
      demand(!previous || previous.sha256 === partHash, "A different upload part was already stored.", 409);
      if (!previous) await models.PrivateReportFile.create([{ _id: partId, cohortId: current.cohortId,
        bytes, sha256: partHash, createdAt: new Date(), expiresAt: new Date(Date.now() + 3600000) }], { session });
      await models.PilotEvidence.updateOne({ _id: id }, { $set: { "data.uploadParts": { count, totalSize } }, $inc: { version: 1 } }, { session });
      const partIds = Array.from({ length: count }, (_, index) => `${id}:part:${index}`);
      const parts = await models.PrivateReportFile.find({ _id: { $in: partIds }, cohortId: current.cohortId }).select("+bytes").session(session).lean();
      if (parts.length !== count) return { evidenceId: id, part, stored: false };
      bytes = Buffer.concat(partIds.map(key => {
        const file = parts.find(row => row._id === key);
        const data = Buffer.isBuffer(file.bytes) ? file.bytes : Buffer.from(file.bytes.buffer);
        demand(createHash("sha256").update(data).digest("hex") === file.sha256, "Upload part integrity check failed.", 409);
        return data;
      }));
      demand(bytes.length === totalSize, "Assembled upload size mismatch.", 400);
      inspectEvidence(bytes, ext);
      size = bytes.length;
      await models.PrivateReportFile.deleteMany({ _id: { $in: partIds }, cohortId: current.cohortId }).session(session);
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    await models.PrivateReportFile.create([{ _id: id, cohortId: current.cohortId, bytes, sha256, createdAt: new Date() }], { session });
    await models.PilotEvidence.updateOne({ _id: id, cohortId: current.cohortId }, { $set: {
      "data.size": size, "data.sha256": sha256, "data.contentType": mime[ext], "data.uploadedAt": new Date(),
    }, $inc: { version: 1 } }, { session });
    return { evidenceId: id, size, sha256 };
  });
}
export async function bytesFor(e) {
  if (e.data.provider === "MONGODB") {
    const file = await models.PrivateReportFile.findOne({ _id: e._id, cohortId: e.cohortId }).select("+bytes").lean();
    demand(file, "Private object unavailable.", 404);
    const bytes = Buffer.isBuffer(file.bytes) ? file.bytes : Buffer.from(file.bytes.buffer);
    demand(bytes.length === e.data.size && bytes.length <= 5 * 1024 * 1024 &&
      createHash("sha256").update(bytes).digest("hex") === e.data.sha256 && file.sha256 === e.data.sha256,
      "Private object integrity check failed.", 409);
    return bytes;
  }
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
  demand(e.userId === user._id);
  if (["READY", "RETURN"].includes(e.state)) return { evidenceId: e._id };
  demand(e.state === "PENDING");
  const info = e.data.provider === "MONGODB"
    ? { size: e.data.size, contentType: e.data.contentType, etag: e.data.sha256 }
    : await head(e.data.path);
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
    ...(e.data.reportKind && { sprintId: e.sprintId }),
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

export async function privateFileResponse(actor, id) {
  const e = await authorisedFile(actor, id);
  demand(["READY", "RETURN"].includes(e.state), "Upload is not verified.", 409);
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
  if (e.data.provider !== "MONGODB") return new Response(null, { status: 303,
    headers: { ...headers, Location: await fileDownload(actor, id) } });
  const bytes = await bytesFor(e);
  const stream = new ReadableStream({ start(controller) {
    for (let offset = 0; offset < bytes.length; offset += 64 * 1024) controller.enqueue(new Uint8Array(bytes.subarray(offset, offset + 64 * 1024)));
    controller.close();
  } });
  return new Response(stream, { headers: { ...headers,
    "Content-Type": e.data.contentType,
    "Content-Disposition": `attachment; filename="${e.data.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
  } });
}
