// Posts one Adaptive Card per candidate to a Microsoft Teams channel.
// Works with a Teams "Workflows" webhook (Post to a channel when a webhook request is received)
// and with legacy Incoming Webhook URLs.
import { CONFIG, DIMENSION_LABELS, WEIGHTS } from "./config.js";

const COLOR = { ADVANCE: "Good", REVIEW: "Warning", REJECT: "Attention", INCOMPLETE: "Attention" };

export function buildCard(result) {
  const r = result;
  const tx = (text, extra = {}) => ({ type: "TextBlock", text, wrap: true, ...extra });

  const dimRows = Object.keys(WEIGHTS).map((k) => {
    const d = r.dimensions[k];
    const flag = r.floorBreaches.includes(k) ? " ⛔" : "";
    return {
      type: "Container", spacing: "Small",
      items: [
        tx(`**${DIMENSION_LABELS[k]}** (${Math.round(WEIGHTS[k] * 100)}%) - **${d.score}**${flag}`),
        tx(d.feedback, { isSubtle: true, spacing: "None", size: "Small" }),
      ],
    };
  });

  let transcript = r.transcript.map((m) => `**${m.role === "agent" ? "Candidate" : r.customerFirst}:** ${m.text}`).join("\n\n");
  if (transcript.length > 12000) transcript = transcript.slice(0, 12000) + "\n\n…(truncated)";

  const integrityText = r.integrity.pass
    ? "✅ Pass"
    : "❌ FAIL - " + r.integrity.violations.map((v) => `${v.type}: "${v.quote}"`).join("; ");

  const card = {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard", version: "1.4", msteams: { width: "Full" },
    body: [
      tx(`DreamPort Chat Assessment - [${r.candidate}](mailto:${r.candidate})`, { size: "Large", weight: "Bolder" }),
      tx(`**${r.decision}** · Overall ${r.overall}/100 · ${r.decisionReason}`, { color: COLOR[r.decision] || "Default", weight: "Bolder" }),
      {
        type: "FactSet",
        facts: [
          { title: "Communication (60%)", value: String(r.commScore) },
          { title: "Sales skills (40%)", value: String(r.salesScore) },
          { title: "Sales integrity", value: integrityText },
          { title: "Integrity review flag", value: r.integrityReviewFlag || "-" },
          { title: "Candidate email", value: r.candidate },
          { title: "Outcome", value: r.outcome },
          { title: "Recommended option", value: `${r.recommendedOption} (correct: ${r.correctOption})` },
          { title: "Concern shift", value: r.shiftHandling },
          { title: "Route", value: r.route },
          { title: "Concern sequence", value: r.concernSequence },
          { title: "Turns / duration", value: `${r.agentTurns} msgs · ${r.durationMin} min` },
          { title: "Paste attempts", value: String(r.pasteAttempts) },
          { title: "Unverified quotes dropped", value: String(r.droppedQuotes) },
          { title: "Completed", value: r.finishedAt },
          { title: "Session", value: r.sid },
        ],
      },
      tx(`**Summary:** ${r.summary}`),
      ...dimRows,
    ],
    actions: [
      { type: "Action.ShowCard", title: "Show transcript", card: { type: "AdaptiveCard", body: [tx(transcript, { size: "Small" })] } },
    ],
  };
  return card;
}

export async function postToTeams(result) {
  const card = buildCard(result);
  if (CONFIG.mock || !CONFIG.teamsWebhook) {
    console.log("[teams] webhook not configured - result logged only:", JSON.stringify(result).slice(0, 4000));
    return { ok: false, skipped: true, card };
  }
  const payload = {
    type: "message",
    attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", contentUrl: null, content: card }],
  };
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(CONFIG.teamsWebhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (r.ok || r.status === 202) return { ok: true };
      console.error("[teams] status", r.status, await r.text().catch(() => ""));
    } catch (e) {
      console.error("[teams] error", e.message);
    }
    await new Promise((res) => setTimeout(res, 700 * (i + 1)));
  }
  // Fallback: full result in Vercel logs so nothing is lost.
  console.error("[teams] FAILED after retries. RESULT_JSON=" + JSON.stringify(result));
  return { ok: false };
}
