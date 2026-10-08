// Minimal Anthropic Messages API client (no SDK dependency). Retries transient errors.
import { CONFIG } from "./config.js";

export async function claude({ model, system, messages, maxTokens = 400, temperature = 0.7 }) {
  if (CONFIG.mock) return mockReply(system, messages);

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": CONFIG.anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({ model, system, messages, max_tokens: maxTokens, temperature }),
      });
      if (r.status === 429 || r.status >= 500) {
        lastErr = new Error("anthropic " + r.status);
        await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
        continue;
      }
      const j = await r.json();
      if (!r.ok) throw new Error("anthropic " + r.status + ": " + (j.error && j.error.message));
      return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    } catch (e) {
      lastErr = e;
      if (String(e.message).startsWith("anthropic 4")) break;
    }
  }
  throw lastErr;
}

// ---- deterministic mocks for local smoke tests (MOCK_AI=1) ----
function mockReply(system, messages) {
  if (system.includes("Sales Floor assessor")) {
    const tr = messages[0].content;
    const firstAgent = (tr.match(/CANDIDATE \(turn 1\): (.*)/) || [])[1] || "";
    const quote = firstAgent.split(" ").slice(0, 6).join(" ");
    const dim = (score) => ({ score, evidence: [quote, "this quote does not exist in the transcript"], feedback: "Mock feedback sentence one. Sentence two. Sentence three should be trimmed." });
    return JSON.stringify({
      dimensions: {
        client_management: dim(72), language_skills: dim(80), attitude_behavior: dim(75), client_profiling: dim(60),
        adaptability: dim(55), objection_handling: dim(58), sales_negotiation: dim(62), closing: dim(40),
      },
      integrity: { pass: false, violations: [{ type: "invented", quote: "a quote the model hallucinated", explanation: "Should be discarded by server verification." }] },
      recommended_option: "B", shift_handling: "partial", summary: "Mock summary.",
    });
  }
  const n = messages.filter((m) => m.role === "user").length;
  const concern = (system.match(/ACTIVE CONCERN \(what is on your mind RIGHT NOW\): (.*)/) || [])[1];
  const text = concern ? `hmm ok. but honestly - ${concern.toLowerCase()}?` : "who is this? i'm kinda busy";
  const state = system.includes("You have to go now") ? "lost" : "continue";
  return `${text} (mock turn ${n})\n<<STATE:${state}>>`;
}
