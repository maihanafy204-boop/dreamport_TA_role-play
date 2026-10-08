// Scoring pipeline: AI rubric scoring -> server-side evidence verification -> weighted score
// -> gates (Sales Integrity overrides all; communication floor) -> decision.
import { CONFIG, WEIGHTS, FLOOR_DIMENSIONS } from "./config.js";
import { claude } from "./anthropic.js";
import { scorerSystemPrompt, scorerUserPrompt } from "./prompts.js";
import { allowedAmounts } from "./scenario.js";

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9$£€'%.,!? ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function verifyQuote(q, agentCorpus) {
  const n = norm(q).replace(/^["']|["']$/g, "");
  return n.length >= 4 && agentCorpus.includes(n);
}

function twoSentences(s) {
  const parts = String(s || "").replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [];
  return parts.slice(0, 2).join("").trim().slice(0, 400);
}

const DISCOUNT_RE = /\b(discount|price ?match|match (that|the|their) (price|fare)|lower (the )?price|reduce (the )?price|special (price|deal|offer)|knock .{0,15}off|take .{0,15}off|\d+ ?% off|cheaper for you|best i can do is)\b/i;

export function computeFacts(s, transcript, meta) {
  const agentMsgs = transcript.filter((m) => m.role === "agent");
  const allowed = allowedAmounts(s.publicView);
  const off = new Set();
  agentMsgs.forEach((m) => {
    const re = /(?:\$|£|€|ca\$|cad|usd|gbp)\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?|(\d{2,3}(?:,\d{3})+|\d{3,5})\s?(?:\$|dollars|pounds|cad|usd|gbp)/gi;
    let x;
    while ((x = re.exec(m.text))) {
      const n = Number((x[1] || x[2]).replace(/,/g, ""));
      if (n >= 10 && !allowed.has(n)) off.add(x[0].trim());
    }
  });
  const discountHits = agentMsgs.filter((m) => DISCOUNT_RE.test(m.text)).map((m) => m.text.slice(0, 160));
  const words = agentMsgs.reduce((a, m) => a + m.text.split(/\s+/).filter(Boolean).length, 0);
  const shiftsReached = s.hidden.shiftTurns.slice(1).filter((t) => meta.agentTurns >= t).length;
  return {
    outcome: meta.outcome,
    agentTurns: meta.agentTurns,
    durationMin: meta.durationMin,
    avgWords: agentMsgs.length ? Math.round(words / agentMsgs.length) : 0,
    offPanelAmounts: [...off],
    discountHits,
    shiftsReached,
  };
}

function parseJson(text) {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b < 0) throw new Error("scorer returned no JSON");
  return JSON.parse(text.slice(a, b + 1));
}

export async function scoreSession(s, transcript, meta) {
  const facts = computeFacts(s, transcript, meta);
  const agentCorpus = norm(transcript.filter((m) => m.role === "agent").map((m) => m.text).join(" \n "));

  let raw;
  for (let i = 0; i < 2; i++) {
    try {
      const out = await claude({
        model: CONFIG.modelScorer,
        system: scorerSystemPrompt(),
        messages: [{ role: "user", content: scorerUserPrompt(s, transcript, facts) }],
        maxTokens: 3000,
        temperature: 0,
      });
      raw = parseJson(out);
      break;
    } catch (e) {
      if (i === 1) throw e;
    }
  }

  // ---- verify & normalise ----
  let dropped = 0;
  const dimensions = {};
  for (const k of Object.keys(WEIGHTS)) {
    const d = (raw.dimensions || {})[k] || {};
    const score = Math.max(0, Math.min(100, Math.round(Number(d.score) || 0)));
    const ev = (Array.isArray(d.evidence) ? d.evidence : []).filter((q) => {
      const ok = verifyQuote(q, agentCorpus);
      if (!ok) dropped++;
      return ok;
    });
    dimensions[k] = { score, evidence: ev.slice(0, 3), feedback: twoSentences(d.feedback) || "No evidence in transcript." };
  }

  const violations = ((raw.integrity || {}).violations || []).filter((v) => {
    const ok = v && verifyQuote(v.quote, agentCorpus);
    if (!ok) dropped++;
    return ok;
  }).map((v) => ({ type: String(v.type || "violation").slice(0, 60), quote: String(v.quote).slice(0, 200), explanation: twoSentences(v.explanation) }));
  // Integrity fails only on a verified verbatim quote - a hallucinated violation can't reject anyone.
  const integrity = { pass: violations.length === 0, violations };

  // Regex signals the model didn't confirm -> human review flag (never auto-reject).
  let integrityReviewFlag = "";
  if (integrity.pass && (facts.discountHits.length || facts.offPanelAmounts.length)) {
    integrityReviewFlag = [
      facts.discountHits.length ? `discount-like wording (${facts.discountHits.length})` : "",
      facts.offPanelAmounts.length ? `off-panel amounts: ${facts.offPanelAmounts.join(", ")}` : "",
    ].filter(Boolean).join("; ");
  }

  // ---- weighted score & gates ----
  const overall = Math.round(Object.keys(WEIGHTS).reduce((a, k) => a + dimensions[k].score * WEIGHTS[k], 0));
  const sub = (keys) => Math.round(keys.reduce((a, k) => a + dimensions[k].score * WEIGHTS[k], 0) / keys.reduce((a, k) => a + WEIGHTS[k], 0));
  const commScore = sub(["client_management", "language_skills", "attitude_behavior"]);
  const salesScore = sub(["client_profiling", "adaptability", "objection_handling", "sales_negotiation", "closing"]);
  const floorBreaches = FLOOR_DIMENSIONS.filter((k) => dimensions[k].score < CONFIG.commFloor);

  let decision, decisionReason;
  if (!integrity.pass) {
    decision = "REJECT"; decisionReason = "Sales Integrity gate failed (overrides all scores)";
  } else if (meta.agentTurns < 3) {
    decision = "INCOMPLETE"; decisionReason = `Only ${meta.agentTurns} candidate message(s)`;
  } else if (floorBreaches.length) {
    decision = "REJECT"; decisionReason = `Communication floor (<${CONFIG.commFloor}) breached: ${floorBreaches.join(", ")}`;
  } else if (overall >= CONFIG.passThreshold) {
    decision = "ADVANCE"; decisionReason = `Overall ≥ ${CONFIG.passThreshold}`;
  } else if (overall >= CONFIG.reviewThreshold) {
    decision = "REVIEW"; decisionReason = `Overall ${CONFIG.reviewThreshold}-${CONFIG.passThreshold - 1}: recruiter review`;
  } else {
    decision = "REJECT"; decisionReason = `Overall < ${CONFIG.reviewThreshold}`;
  }

  const ro = String(raw.recommended_option || "none").toUpperCase();
  return {
    overall, commScore, salesScore, dimensions, integrity, integrityReviewFlag, floorBreaches,
    decision, decisionReason, droppedQuotes: dropped,
    recommendedOption: ["A", "B", "BOTH", "NONE"].includes(ro) ? ro : "NONE",
    shiftHandling: ["handled", "partial", "missed", "not_reached"].includes(raw.shift_handling) ? raw.shift_handling : "unknown",
    summary: twoSentences(raw.summary),
    facts,
  };
}

// What the candidate is allowed to see: a pass / not-yet message, never a score.
export function candidateOutcome(decision) {
  if (decision === "ADVANCE") return "pass";
  if (decision === "REVIEW") return CONFIG.reviewShowsAs === "pass" ? "pass" : "training";
  return "training";
}
