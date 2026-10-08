import { CONFIG, assertConfig, WEIGHTS } from "../lib/config.js";
import { unseal } from "../lib/crypto.js";
import { claimFinish } from "../lib/store.js";
import { scoreSession, candidateOutcome } from "../lib/scoring.js";
import { postToTeams } from "../lib/teams.js";
import { readJson, send, cleanText } from "../lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  const links = { applyUrl: CONFIG.applyUrl, trainingUrl: CONFIG.trainingUrl || CONFIG.applyUrl };
  try {
    assertConfig();
    const body = await readJson(req);
    let s;
    try { s = unseal(body.token); } catch { return send(res, 400, { error: "SESSION" }); }

    // One result per session (double-clicks, tab-close beacons, replays).
    if (!(await claimFinish(s.sid))) return send(res, 200, { ok: true, outcome: "neutral", ...links });

    s.paste = Math.max(s.paste || 0, Math.min(999, Number(body.pasteAttempts) || 0));
    const reason = cleanText(body.reason, 30);
    const transcript = s.transcript;
    const agentTurns = transcript.filter((m) => m.role === "agent").length;
    const outcome = s.outcome || (reason === "abandoned" ? "abandoned" : reason === "time" ? "timeout" : "ended_by_candidate");
    const durationMin = Math.round(((transcript.length ? transcript[transcript.length - 1].ts : Date.now()) - s.startedAt) / 6000) / 10;
    const pv = s.scenario.publicView;
    const h = s.scenario.hidden;

    const base = {
      candidate: s.candidate,
      sid: s.sid,
      finishedAt: new Date().toISOString(),
      route: `${pv.route} · ${pv.travelers} pax · ${pv.currency}`,
      customerFirst: pv.customer.first,
      correctOption: h.correctOption,
      concernSequence: h.sequence.map((c, i) => `${i + 1}) ${c.label} @turn ${h.shiftTurns[i]}`).join("  "),
      outcome,
      agentTurns,
      durationMin,
      pasteAttempts: s.paste,
      transcript,
    };

    let result;
    if (agentTurns === 0) {
      result = emptyResult(base, "INCOMPLETE", "No candidate messages");
    } else {
      try {
        const sc = await scoreSession(s.scenario, transcript, { outcome, agentTurns, durationMin });
        result = { ...base, ...sc };
      } catch (e) {
        console.error("[finish] scoring failed", e);
        result = emptyResult(base, "REVIEW", "Automatic scoring failed - review transcript manually");
        result.scoringError = true;
      }
    }

    await postToTeams(result);

    // Candidate never sees a score - only which end message to show.
    const shown = result.scoringError || reason === "abandoned" ? "neutral" : candidateOutcome(result.decision);
    return send(res, 200, { ok: true, outcome: shown, ...links });
  } catch (e) {
    console.error("[finish]", e);
    return send(res, 200, { ok: true, outcome: "neutral", ...links });
  }
}

function emptyResult(base, decision, reason) {
  const dimensions = {};
  Object.keys(WEIGHTS).forEach((k) => (dimensions[k] = { score: 0, evidence: [], feedback: "Not scored." }));
  return {
    ...base, overall: 0, commScore: 0, salesScore: 0, dimensions,
    integrity: { pass: true, violations: [] }, integrityReviewFlag: "", floorBreaches: [],
    decision, decisionReason: reason, droppedQuotes: 0, recommendedOption: "NONE",
    shiftHandling: "not_reached", summary: reason,
  };
}
