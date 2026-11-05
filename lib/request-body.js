export async function boundedJson(request, limit = 100000) {
  const reader = request.body?.getReader();
  if (!reader)
    throw Object.assign(new Error("JSON body required."), { status: 400 });
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw Object.assign(new Error("Request is too large."), { status: 413 });
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
