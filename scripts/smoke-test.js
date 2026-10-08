// End-to-end smoke test with mocked AI (no API cost):
//   MOCK_AI=1 SESSION_SECRET=devsecretdevsecret node scripts/smoke-test.js
import assert from "node:assert";
const base = process.env.BASE || "http://localhost:3000";
const post = async (p, b) => { const r = await fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); return { status: r.status, data: await r.json() }; };

let r = await post("/api/start", { candidate: "" });
assert.equal(r.status, 400, "email required");
r = await post("/api/start", { candidate: "Smoke Tester" });
assert.equal(r.status, 400, "invalid email rejected");

r = await post("/api/start", { candidate: "Smoke.Tester@Example.com" });
assert.equal(r.status, 200);
const view = r.data.view;
const leak = JSON.stringify(r.data);
for (const w of ["correctOption", "sequence", "shiftTurns", "facts", "history", "reasons"]) assert(!leak.includes(w), "public payload leaks: " + w);
console.log("start ok:", view.route, "|", view.customer.name, "| pax", view.travelers);

let token = r.data.token;
const first = token;
const msgs = [
  `Hi ${view.customer.first}, this is Alex from DreamPort following up on your trip quote.`,
  "Could you tell me who is travelling and what matters most to you?",
  "I understand completely. Option B is $999 for you today, I can give you a discount.",
  "That's a fair question, let me explain the difference between the options.",
  "Shall I go ahead and book Option B for you now?",
];
for (const m of msgs) {
  r = await post("/api/chat", { token, message: m });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  token = r.data.token;
  console.log("  customer:", r.data.reply);
}
// replay an old token -> rejected
r = await post("/api/chat", { token: first, message: "retry" });
assert.equal(r.status, 409, "replay must be rejected");
console.log("replay rejected ok");
// tampered token -> rejected
r = await post("/api/chat", { token: token.slice(0, -4) + "AAAA", message: "x" });
assert.equal(r.status, 400, "tamper must be rejected");
console.log("tamper rejected ok");

r = await post("/api/finish", { token, reason: "candidate" });
assert.equal(r.status, 200);
assert(["pass", "training", "neutral"].includes(r.data.outcome));
assert(!("overall" in r.data) && !("score" in r.data), "score must never reach the browser");
console.log("finish ok -> candidate sees:", r.data.outcome, r.data.applyUrl);
r = await post("/api/finish", { token, reason: "candidate" });
assert.equal(r.data.outcome, "neutral", "second finish must not re-score");

for (const p of ["/lib/prompts.js", "/lib/scenario.js", "/api/chat.js", "/.env.example"]) {
  const s = (await fetch(base + p)).status;
  assert.notEqual(s, 200, p + " must not be served");
}
console.log("server files not served ok\nALL SMOKE TESTS PASSED");
