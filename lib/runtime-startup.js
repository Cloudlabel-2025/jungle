// WebContainer startup cannot be aborted at the provider. Bound the UI wait
// and release a resource that arrives after cancellation or timeout.
export function awaitRuntimeStartup(
  promise,
  { timeoutMs = 30000, signal, releaseLate } = {},
) {
  return new Promise((resolve, reject) => {
    let settled = false,
      timer;
    const finish = (callback, value) => {
      if (settled) return false;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      callback(value);
      return true;
    };
    const abort = () =>
      finish(
        reject,
        Object.assign(
          new Error(
            "Node startup was cancelled. Reload the coding studio to reconnect, or continue with local code sync.",
          ),
          { code: "STARTUP_CANCELLED" },
        ),
      );
    if (signal?.aborted) abort();
    else {
      signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(
        () =>
          finish(
            reject,
            Object.assign(
              new Error(
                "The browser Node runtime did not connect in time. Reload the coding studio to reconnect, or continue with local code sync.",
              ),
              { code: "STARTUP_TIMEOUT" },
            ),
          ),
        timeoutMs,
      );
    }
    Promise.resolve(promise).then(
      (value) => {
        if (!finish(resolve, value)) {
          try {
            releaseLate?.(value);
          } catch {}
        }
      },
      (error) => finish(reject, error),
    );
  });
}
