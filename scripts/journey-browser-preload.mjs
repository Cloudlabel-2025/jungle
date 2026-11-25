// Disposable browser fixture only. The launcher supplies the in-memory DB and
// explicit fixture flag. Normal dev/start/build commands never import this file.
import "./part-b-browser-clock.mjs";
if (process.env.JOURNEY_BROWSER_FIXTURE === "fictional-disposable-only") {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = String(input?.url || input);
    if (
      /^https:\/\/chatgpt\.com\/backend-api\/share\/11111111-1111-1111-1111-11111111111[12]$/.test(
        url,
      )
    ) {
      const answer =
        "Automobiles research compares alternatives using the same travel distance, energy costs, maintenance, safety and environmental assumptions. A source must describe its method and date before we trust its conclusion. Compare the alternatives against the same budget and explain what evidence would change the decision. Independent verification matters because a confident answer can contain an incorrect assumption. Sources: https://example.org/research-method. The remaining uncertainty concerns local prices and the reliability of the estimates. Test the conclusion using a separate published source and record any disagreement rather than hiding it.";
      const prompts = [
        "Investigate Automobiles research and compare alternatives.",
        "Compare the costs and trade-offs using evidence.",
        "Verify the sources and explain remaining uncertainty.",
      ];
      return Response.json({
        linear_conversation: prompts.flatMap((text) => [
          {
            author: { role: "user" },
            content: { content_type: "text", parts: [text] },
          },
          {
            author: { role: "assistant" },
            content: { content_type: "text", parts: [answer] },
          },
        ]),
      });
    }
    return originalFetch(input, options);
  };
}
