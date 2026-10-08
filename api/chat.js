import { CONFIG, assertConfig } from "../lib/config.js";
import { seal, unseal } from "../lib/crypto.js";
import { getTurn, setTurn } from "../lib/store.js";
import { claude } from "../lib/anthropic.js";
import { customerSystemPrompt } from "../lib/prompts.js";
import { readJson, send, cleanText } from "../lib/http.js";

const STATES = ["continue", "booked", "followup", "lost"];

function parseCustomer(text) {
  const m = text.match(/<<\s*STATE\s*:\s*(\w+)\s*>>/i);
  const state = m && STATES.includes(m[1].toLowerCase()) ? m[1].toLowerCase() : "continue";
  const reply = text
    .replace(/<<[^>]*>>/g, "")
    .replace(/^\s*(customer|assistant)\s*:\s*/i, "")
    .trim()
    .slice(0, 700);
  return { state, reply: reply || "sorry, what do you mean?" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  try {
    assertConfig();
    const body = await readJson(req);
    let s;
    try { s = unseal(body.token); } catch { return send(res, 400, { error: "SESSION" }); }
    if (s.status !== "active") return send(res, 409, { error: "ENDED" });

    // Anti-replay: the token's turn must match the server's record.
    const stored = await getTurn(s.sid);
    if (stored !== null && stored !== s.turn) return send(res, 409, { error: "STALE" });

    s.paste = Math.max(s.paste || 0, Math.min(999, Number(body.pasteAttempts) || 0));

    if (Date.now() - s.startedAt > CONFIG.timeLimitMs + 30000) {
      s.status = "ended"; s.outcome = "timeout";
      return send(res, 200, { ended: true, reason: "time", token: seal(s) });
    }

    const text = cleanText(body.message, CONFIG.maxMessageChars);
    if (text.length < 1) return send(res, 400, { error: "EMPTY" });

    const turn = s.turn + 1;
    s.transcript.push({ role: "agent", text, turn, ts: Date.now() });

    const messages = s.transcript.map((m) => ({ role: m.role === "agent" ? "user" : "assistant", content: m.text }));
    const raw = await claude({
      model: CONFIG.modelCustomer,
      system: customerSystemPrompt(s.scenario, turn),
      messages,
      maxTokens: 300,
      temperature: 0.8,
    });
    const { state, reply } = parseCustomer(raw);

    s.transcript.push({ role: "customer", text: reply, ts: Date.now() });
    s.turn = turn;

    let ended = false;
    if (state !== "continue" || turn >= CONFIG.maxAgentTurns) {
      ended = true;
      s.status = "ended";
      s.outcome = state === "continue" ? "turn_limit" : state;
    }
    await setTurn(s.sid, turn);

    return send(res, 200, { reply, ended, token: seal(s) });
  } catch (e) {
    console.error("[chat]", e);
    return send(res, 502, { error: "AI" });
  }
}
