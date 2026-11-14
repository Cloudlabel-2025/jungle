import { createHash } from "node:crypto";

export const SHARED_CHAT_READER = "chatgpt-public-v1";
const MAX_BYTES = 2 * 1024 * 1024;
const fail = (code, message) => {
  throw Object.assign(new Error(message), { code });
};

export function sharedChatAddress(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("INVALID_LINK", "Use a public ChatGPT conversation share link.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !["chatgpt.com", "chat.openai.com"].includes(url.hostname)
  )
    fail(
      "UNSUPPORTED_LINK",
      "Automatic reading currently supports public ChatGPT share links. Use Share → Copy link in ChatGPT; private chat and other-provider links need Command review.",
    );
  const match =
    /^\/share\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/?$/i.exec(
      url.pathname,
    );
  if (!match || [...url.searchParams.keys()].some((k) => k !== "locale"))
    fail(
      "INVALID_LINK",
      "Use the public /share/ link, not your private conversation address.",
    );
  const id = match[1].toLowerCase();
  return {
    canonicalUrl: `https://chatgpt.com/share/${id}`,
    dataUrl: `https://chatgpt.com/backend-api/share/${id}`,
  };
}

function visibleMessages(data) {
  if (!data || typeof data !== "object")
    fail(
      "READER_FORMAT",
      "The shared conversation response could not be read.",
    );
  let nodes;
  if (data.mapping && data.current_node) {
    nodes = [];
    const seen = new Set();
    let id = data.current_node;
    while (id) {
      if (seen.has(id) || seen.size > 2000 || !Object.hasOwn(data.mapping, id))
        fail("READER_FORMAT", "The shared conversation path is invalid.");
      seen.add(id);
      const node = data.mapping[id];
      nodes.push(node);
      id = node.parent;
    }
    nodes.reverse();
  } else if (Array.isArray(data.linear_conversation))
    nodes = data.linear_conversation;
  else
    fail(
      "READER_FORMAT",
      "The provider returned a preview instead of conversation messages. Retry or check public sharing.",
    );
  return nodes
    .map((n) => n?.message || n)
    .filter(
      (m) =>
        ["user", "assistant"].includes(m?.author?.role) &&
        !m.metadata?.is_visually_hidden_from_conversation &&
        (!m.channel || m.channel === "final") &&
        ["text", "multimodal_text"].includes(m.content?.content_type),
    );
}

function sourceUrls(message) {
  const urls = new Set();
  function visit(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 6) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 200)) visit(item, depth + 1);
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      if (
        ["url", "source_url"].includes(key) &&
        typeof item === "string" &&
        /^https:\/\//i.test(item) &&
        item.length < 2000
      )
        urls.add(item);
      else if (typeof item === "object") visit(item, depth + 1);
    }
  }
  visit(message.metadata?.citations);
  visit(
    message.metadata?.content_references?.filter((r) =>
      ["webpage", "citation", "source", "sources_footnote"].includes(r.type),
    ),
  );
  // Modern shared answers encode citations as turn IDs. Resolve only entries
  // actually cited in the visible answer, never every background search result.
  const content = message.content.parts.filter(p => typeof p === "string").join("\n");
  const cited = new Set(content.match(/turn\d+(?:search|view|news)\d+/g) || []);
  for (const group of message.metadata?.search_result_groups || []) for (const entry of group.entries || []) {
    const ref = entry.ref_id;
    const id = typeof ref === "string" ? ref : ref ? `turn${ref.turn_index}${ref.ref_type}${ref.ref_index}` : "";
    if (cited.has(id) && typeof entry.url === "string" && /^https:\/\//i.test(entry.url) && entry.url.length < 2000) urls.add(entry.url);
  }
  return [...urls].slice(0, 100);
}

export function extractSharedChat(data, canonicalUrl, fetchedAt = new Date()) {
  const turns = visibleMessages(data)
    .map((message) => {
      const content = message.content.parts
        ?.map((p) =>
          typeof p === "string"
            ? p
            : ["text", "output_text"].includes(p?.type)
              ? p.text || ""
              : "",
        )
        .join("\n")
        .trim();
      if (!content) return null;
      const sources =
        message.author.role === "assistant" ? sourceUrls(message) : [];
      return {
        role: message.author.role,
        text:
          content + (sources.length ? `\nSources: ${sources.join("\n")}` : ""),
      };
    })
    .filter(Boolean);
  const userTurns = turns.filter((t) => t.role === "user").length;
  const assistantTurns = turns.filter((t) => t.role === "assistant").length;
  if (!userTurns || !assistantTurns)
    fail(
      "EMPTY_CONVERSATION",
      "The shared link must include your research question and an AI response. Check that you shared the whole conversation.",
    );
  const transcript = turns
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.text}`)
    .join("\n\n");
  if (transcript.length > 120000)
    fail(
      "CONVERSATION_TOO_LARGE",
      "This conversation is too large for automatic review. Command can review it without changing your submission time.",
    );
  return {
    ok: true,
    transcript,
    evidence: {
      readerVersion: SHARED_CHAT_READER,
      provider: "ChatGPT",
      canonicalUrl,
      fetchedAt: fetchedAt.toISOString(),
      title:
        typeof data.title === "string"
          ? data.title.slice(0, 300)
          : "Shared conversation",
      userTurns,
      assistantTurns,
      characters: transcript.length,
      ...(typeof data.update_time === "number" &&
      Number.isFinite(data.update_time) &&
      data.update_time > 0 &&
      data.update_time < 8640000000000
        ? { providerUpdatedAt: new Date(data.update_time * 1000).toISOString() }
        : {}),
      sha256: createHash("sha256").update(transcript).digest("hex"),
    },
  };
}

export async function readSharedChat(
  value,
  { fetchImpl = fetch, now = new Date(), timeoutMs = 12000 } = {},
) {
  let timer;
  try {
    const address = sharedChatAddress(value);
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);
    // Fixed provider hostname/path, no cookies/credentials, and no redirects.
    // Conversation text is data; it is never executed or followed as instructions.
    const response = await fetchImpl(address.dataUrl, {
      redirect: "manual",
      credentials: "omit",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "CODEWILD-ResearchReader/1.0",
      },
    });
    if (response.status >= 300 && response.status < 400)
      fail(
        "REDIRECT_BLOCKED",
        "The shared link redirected instead of returning a public conversation. Check sharing or retry.",
      );
    if ([401, 403, 404, 410].includes(response.status))
      fail(
        "NOT_PUBLIC",
        "The conversation is private, unavailable or no longer shared. Publish a public share link and retry review.",
      );
    if (!response.ok)
      fail(
        "PROVIDER_UNAVAILABLE",
        "The AI provider could not return the conversation. Your work is saved; retry review shortly.",
      );
    if (!response.headers.get("content-type")?.includes("application/json"))
      fail(
        "READER_FORMAT",
        "The provider returned a sign-in or preview page. Check public sharing and retry.",
      );
    if (Number(response.headers.get("content-length") || 0) > MAX_BYTES)
      fail(
        "CONVERSATION_TOO_LARGE",
        "The shared conversation response is too large for automatic review.",
      );
    const reader = response.body?.getReader();
    if (!reader)
      fail("EMPTY_CONVERSATION", "The provider returned no conversation data.");
    const chunks = [];
    let bytes = 0;
    try {
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        bytes += chunk.length;
        if (bytes > MAX_BYTES)
          fail(
            "CONVERSATION_TOO_LARGE",
            "The shared conversation response is too large for automatic review.",
          );
        chunks.push(chunk);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    let data;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      fail(
        "READER_FORMAT",
        "The provider returned unreadable conversation data. Retry review shortly.",
      );
    }
    return extractSharedChat(data, address.canonicalUrl, now);
  } catch (error) {
    return {
      ok: false,
      code:
        error.code ||
        (error.name === "AbortError" ? "READ_TIMEOUT" : "PROVIDER_UNAVAILABLE"),
      message: error.code
        ? error.message
        : "The shared conversation could not be read right now. Your submission is saved; retry review shortly.",
    };
  } finally {
    clearTimeout(timer);
  }
}
