function originOf(value) {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    if (url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function allowedWriteOrigin(
  request,
  configuredOrigin = process.env.APP_ORIGIN,
) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser clients still require normal authentication.
  const normalized = originOf(origin);
  if (!normalized) return false;
  const configured = originOf(configuredOrigin);
  if (configured && normalized === configured) return true;

  const url = new URL(request.url);
  // HTTPS may terminate at the deployment proxy before reaching Next.js.
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = ["http", "https"].includes(forwardedProtocol)
    ? `${forwardedProtocol}:`
    : url.protocol;
  const host = request.headers.get("host") || url.host;
  const servedOrigin = originOf(`${protocol}//${host}`);
  return servedOrigin !== null && normalized === servedOrigin;
}
