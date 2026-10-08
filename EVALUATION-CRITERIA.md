# Chat Assessment — Evaluation Criteria (INTERNAL — do not share with candidates)

## 1. Weighted score (0–100)

| Group | Dimension | Weight | What it measures (written chat) |
|---|---|---|---|
| Communication 60% | Client Management | 25% | Personal, relevant opening (name, why they're reaching out, the trip); acknowledges the BQ history; purposeful control of the conversation; respects the customer's time |
| | Language Skills | 20% | **Written** English: grammar, spelling, punctuation, clarity, concise and professional chat register |
| | Attitude & Behavior | 15% | Empathy, patience, respect under pressure; owns the past bad experience without blaming colleagues |
| Sales 40% | Client Profiling | 9% | Discovery before recommending: who's travelling, needs, budget, flexibility, priorities. Did they uncover the hidden needs? |
| | Adaptability | 9% | When the customer's concern shifted, did the candidate notice and address the new concern, or keep running the old script? Recovery from a cold opening also counts. |
| | Objection Handling | 8% | Acknowledge → clarify → respond with relevant value → confirm, for every concern |
| | Sales & Negotiation | 8% | Recommends ONE option tied to the needs they discovered (compared against the correct option); sells value; holds the fixed price; offers only relevant add-ons |
| | Closing | 6% | Clear ask for the booking, or a specific next step with a time. No attempt to close = 0–20. |

`Overall = Σ score × weight`, rounded. Both sub-scores are shown on the Teams card.

## 2. Gates and decision (applied in this order)

1. **Sales Integrity: overrides everything → REJECT.** Triggered by any *verified, verbatim* candidate quote showing one of:
   - a discount, price match or "special price", or any price that isn't on the panel (correct multi-traveller or add-on totals are fine)
   - invented fees, promos, policies, availability or urgency
   - misrepresenting stops, bags, change rules or the airline
   - false pressure, or promises outside the candidate's control
2. **Fewer than 3 candidate messages → INCOMPLETE.**
3. **Communication floor → REJECT** if Language, Client Management or Attitude scores below **25**, whatever the overall score.
4. Overall **≥ 70 → ADVANCE** · **55–69 → REVIEW** · **< 55 → REJECT**

Server-side regex checks (discount-like wording, price amounts that aren't on the panel) never auto-reject anyone. If the AI scorer didn't confirm a violation, these checks raise an **Integrity review flag** on the card for a human to look at.

## 3. What the candidate sees

| Decision | End screen |
|---|---|
| ADVANCE | "You're exactly who we're looking for — join us" + Apply link |
| REVIEW | **Not-ready / free-training** screen by default (`REVIEW_SHOWS_AS=pass` switches it to the pass screen) |
| REJECT / INCOMPLETE | "Not quite ready yet — we offer free training" + Start training + Apply link |
| Scoring error | Neutral thank-you + Apply link (the card is marked REVIEW for manual scoring) |

No score, dimension or feedback is ever sent to the browser.

## 4. The hidden scenario mechanics

- **Opening (turn 1):** the customer is guarded and mildly reluctant (BQ history). A vague or generic opening gets a curt, skeptical reply. After two weak replies in a row the customer warns they're leaving, and after a third they leave.
- **Concern sequence:** 3 concerns, randomly ordered. One is always price-related ("saw it cheaper" or "give me a discount"), which tests price integrity. The other two come from: trust/bad history, why-pay-more or connection worry, flexibility, needing to check with someone, and hidden fees/payment safety.
- **Shifts:** concern 1 starts at turn 2. Concern 2 starts at a random turn between 3 and 5, and concern 3 starts 2–3 turns after that. The topic changes abruptly and without warning, decided by the server and not the model.
- **Readiness:** the customer can't agree to book until after the last shift. Then they agree only if (a) the current concern was handled, (b) a specific option was recommended with a needs-based reason, and (c) the candidate clearly asked for the booking or the next step.
- **Correct option:** decided by the hidden needs profile (elderly parent, dates may move, toddler, must arrive rested → **B**; tight budget with fixed dates, or a couple saving → **A**). The candidate can only find this out by asking.

## 5. Guardrails on the AI scorer

- Evidence must be a verbatim substring of a candidate message. Unverified quotes are dropped, and the count is on the card.
- Feedback is cut to at most 2 sentences on the server.
- Temperature 0. The transcript is treated as data, so instructions inside it are ignored.
- Short chats score low on the dimensions the candidate had no chance to show. They don't get a neutral score.

## 6. Known limits

- Without Upstash, anti-replay and one-card-per-session are only best-effort.
- A candidate can start a new session (new scenario) under the same email. Each attempt makes its own card, so recruiters will see repeats.
- Paste blocking only stops casual copy-paste. A determined candidate can type out an AI-drafted answer. Very fast, polished replies are worth a look in the transcript.
- The thresholds (70/55) are starting points. Calibrate them after about 30–50 candidates against your voice-assessment outcomes.
