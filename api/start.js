import { CONFIG, assertConfig } from "../lib/config.js";
import { seal } from "../lib/crypto.js";
import { generateScenario } from "../lib/scenario.js";
import { setTurn } from "../lib/store.js";
import { readJson, send, cleanText } from "../lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  try {
    assertConfig();
    const body = await readJson(req);
    // Candidate is identified by email (validated server-side too, never trusted from the browser).
    const candidate = cleanText(body.candidate, 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(candidate)) return send(res, 400, { error: "EMAIL_REQUIRED" });
    if (CONFIG.accessCode && cleanText(body.accessCode, 60) !== CONFIG.accessCode) {
      return send(res, 401, { error: "ACCESS_CODE" });
    }

    const scenario = generateScenario();
    const session = {
      v: 2,
      sid: scenario.sid,
      candidate,
      scenario,
      transcript: [],
      turn: 0,
      startedAt: Date.now(),
      status: "active",
      outcome: null,
      paste: 0,
    };
    await setTurn(session.sid, 0);

    return send(res, 200, {
      token: seal(session),
      view: scenario.publicView, // the ONLY scenario data the browser ever receives
      limits: { timeLimitMs: CONFIG.timeLimitMs, maxChars: CONFIG.maxMessageChars },
    });
  } catch (e) {
    console.error("[start]", e);
    return send(res, 500, { error: "SERVER" });
  }
}
