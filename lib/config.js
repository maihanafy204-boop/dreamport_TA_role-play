// Central server-side configuration. Nothing in /lib is ever served to the browser
// (vercel.json sets outputDirectory = "public", so only /public is static).

const num = (v, d) => (v !== undefined && v !== "" && !isNaN(Number(v)) ? Number(v) : d);

export const CONFIG = {
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  modelCustomer: process.env.ANTHROPIC_MODEL_CUSTOMER || "claude-sonnet-4-5",
  modelScorer: process.env.ANTHROPIC_MODEL_SCORER || "claude-sonnet-4-5",
  sessionSecret: process.env.SESSION_SECRET || "",
  teamsWebhook: process.env.TEAMS_WEBHOOK_URL || "",
  accessCode: (process.env.ASSESSMENT_ACCESS_CODE || "").trim(),
  maxAgentTurns: num(process.env.MAX_AGENT_TURNS, 14),
  timeLimitMs: num(process.env.TIME_LIMIT_MINUTES, 15) * 60 * 1000,
  passThreshold: num(process.env.PASS_THRESHOLD, 70),
  reviewThreshold: num(process.env.REVIEW_THRESHOLD, 55),
  commFloor: num(process.env.COMM_FLOOR, 25),
  // Which end-screen a REVIEW-band candidate sees: "training" (default, safe) or "pass".
  reviewShowsAs: (process.env.REVIEW_SHOWS_AS || "training").toLowerCase(),
  applyUrl: process.env.APPLY_URL || "https://www.dreamport.me/en?utm_source=role+play",
  // Optional separate link for the free training; falls back to the apply link.
  trainingUrl: process.env.TRAINING_URL || "",
  maxMessageChars: 600,
  upstashUrl: process.env.UPSTASH_REDIS_REST_URL || "",
  upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  mock: process.env.MOCK_AI === "1",
};

// 60% communication / 40% sales. Must sum to 1.00.
export const WEIGHTS = {
  client_management: 0.25,
  language_skills: 0.20,
  attitude_behavior: 0.15,
  client_profiling: 0.09,
  adaptability: 0.09,
  objection_handling: 0.08,
  sales_negotiation: 0.08,
  closing: 0.06,
};

export const DIMENSION_LABELS = {
  client_management: "Client Management",
  language_skills: "Language Skills (written)",
  attitude_behavior: "Attitude & Behavior",
  client_profiling: "Client Profiling",
  adaptability: "Adaptability",
  objection_handling: "Objection Handling",
  sales_negotiation: "Sales & Negotiation",
  closing: "Closing",
};

// Dimensions subject to the hard communication floor.
export const FLOOR_DIMENSIONS = ["language_skills", "client_management", "attitude_behavior"];

export function assertConfig() {
  const missing = [];
  if (!CONFIG.mock && !CONFIG.anthropicKey) missing.push("ANTHROPIC_API_KEY");
  if (!CONFIG.sessionSecret || CONFIG.sessionSecret.length < 16) missing.push("SESSION_SECRET (16+ chars)");
  if (missing.length) throw new Error("Server not configured: " + missing.join(", "));
}
