# Customer Chat Challenge — Evaluation Criteria

This is the complete, exact evaluation logic behind the "Consultant Score" on the public quiz — not a summary. Everything here is copied directly from `index.html` (the `CUES`, `WEAK_CUES`, `messageEffort`, `computePercent`, and `pickResultKey` functions), so this document and the live code can't drift apart as long as it's kept in sync with future edits.

There is no AI involved in scoring. Each of your 5 typed replies is scanned locally, instantly, for a short list of plain-language cues — that's the entire mechanism.

Note on what's visible vs. what's behind the scenes: every visitor still sees the same encouraging 5–98% range, the same personality types, and the same flattering blurbs — none of that changed. What changed is what feeds into that number: the logic below is deliberately more discriminating than the version described in earlier drafts of this document, specifically so the score (and the row written to the spreadsheet) actually separate assertive, closing-oriented replies from ones that hedge or cave — while nobody sees a harsher-looking result on screen for it.

## 1. The four things it looks for

Every reply is checked against three "positive" keyword/phrase lists, plus one "hedging/caving" list that works against you. A category counts as "hit" if the reply matches **any one** phrase in that list (matching isn't case-sensitive, and it matches anywhere in the reply, not just as a whole word unless noted).

**Empathy** — matches if the reply contains any of:
sorry · understand · feel / feeling · appreciate · hear you / hear that · no worries · totally get · congrats / congratulations · excited / exciting · the word "how" · a question mark (?) · aw / aww · makes sense / make sense · fair point / fair question / fair thing · "that must..."

**Confidence** — matches if the reply contains any of:
definitely · absolutely · great choice / great pick · "I'll..." · right away · no problem · perfect · best · recommend · confident / confidence · an exclamation mark (!) · trust me · honestly · "worth it" / "worth the extra" · "here's why" · includes

**Closing** — matches if the reply contains any of:
book / booked · confirm · buy · purchase · lock it/this/that in · deal · yes · sign · let's do this / let's do it · ready · secure · pay · checkout · go ahead · next step · "before [it] changes/moves/[is] gone"

**Hedging / caving** (works against the score — see below) — matches if the reply contains any of:
i guess · i suppose · whatever you want/think/prefer/like · it's up to you · you decide · no pressure · take your time · I'm not sure/certain · not sure · don't know · maybe · if that's ok/okay · either one/way is fine/works/good · doesn't (really) matter · whenever you're/is ready/good/convenient · "I can lower/discount/reduce/drop/knock..." · match that/it/the price · give you a discount · price match · take some/a bit off · special deal/discount for you · "I'll lower/drop/reduce it/the price"

## 2. How one reply is scored (0–4 points)

For each of your 5 replies:

- **+1 point** for each of the 3 positive categories above it hits (so 0–3 points from content)
- **+1 point flat** if the reply is a real sentence — 15 characters or longer — rather than a one- or two-word filler ("ok," "sure thing," "yep")
- **−1 point per hedging/caving phrase hit, up to −2** — this is subtracted from the total above

Two of the five steps get sharper treatment on top of that, because they map directly to the two clearest weak-sales tells in DreamPort's real evaluation rubric — caving on price at the first pushback, and never attempting to close:

- **Step 4 — the price-objection moment** ("my friend found a cheaper flight elsewhere"): if the reply contains *any* hedging/caving phrase, the whole message scores **0**, regardless of anything else it hit. Defending the value instead — without offering a discount or shrugging it off — keeps full credit.
- **Step 5 — the closing moment** ("what happens next?"): the same hedge/cave override applies, and separately, a reply that contains **no closing-category language at all** is capped at **2 points** even if it's warm or confident elsewhere — sounding good isn't the same as asking for the booking.

Maximum per reply: **4 points**, minimum **0**. A short reply that hits no category (e.g. "ok," "sure thing") scores **0** for that reply — there is no minimum/participation credit. That's a deliberate fix from an earlier version of this quiz, which gave low-effort replies an automatic floor score that made the result feel meaningless.

## 3. How the 5 replies become one percentage

Your 5 per-reply scores are added up (0–20 total possible), then mapped onto the displayed percentage:

```
raw = total_points / 20              (0.0 to 1.0)
displayed % = round(5 + raw × 93)    (5% to 98%)
```

So:
- 0 total points (five "ok"-style replies) → **5%**
- ~10 total points (moderate effort, some cues hit) → roughly **50–55%**
- 20 total points (every reply hits all 3 categories and is a full sentence) → **98%**

It's a 5–98% range rather than a literal 0–100% only so the app never shows a jarring "0%" or a boastful "100%" — everything between those two ends is a genuine, proportional read of your 5 replies; nothing is padded or curved beyond that fixed formula.

## 4. How the "personality type" is chosen

Separately from the percentage, each reply's raw hits per category (capped at 3 per reply per category, so 0–15 possible per trait across all 5 replies) are tallied for Empathy, Confidence, and Closing. Whichever trait has the highest total decides the type:

- **Confidence** highest → *The Rising Star*
- **Empathy** highest → *The Relationship Builder*
- **Closing** highest → *The Natural Closer*
- **Top two traits within 1 point of each other** → *The Complete Consultant* (balanced result)

This is flavor for shareability, not a second evaluation — the percentage and the type are computed independently from the same underlying per-reply data.

## 5. What this does *not* evaluate

Worth being explicit about the ceiling here, since it's easy to assume more sophistication than exists:

- It does not understand meaning, tone, sarcasm, or context — only literal keyword/phrase matches (and the hedging list can still be worked around by anyone who phrases a cave without using those exact words).
- It does not check whether what you said was factually correct (e.g. citing the wrong price from the flight-options panel scores the same as citing the right one).
- It does not evaluate grammar, spelling, or writing quality beyond the 15-character length check.
- It's harder to game than the first version of this quiz, but it's still a keyword heuristic, not language understanding — stacking multiple positive-category trigger words into a short reply (e.g. "Definitely! I'll book this now, I understand, perfect!") can still score close to the maximum without a coherent sentence behind it, as long as it avoids the hedging list and includes a closing word at step 5.
- It's the same fixed logic for every visitor; it doesn't adapt or get stricter/more lenient over time.
- The two sharper rules (step 4's caving override, step 5's no-close cap) apply only to those two specific steps by position in the conversation — the same wording said at a different step doesn't trigger them.

This is intentional scope: the quiz is free ad-campaign content meant to be fun, fast, and cheap to run (no AI calls, no cost per visitor). The private hiring assessment tool is where the real, rigorous evaluation happens — this public quiz was never meant to replace or approximate it. It's now tuned to be a genuinely useful first filter (the score and the spreadsheet row meaningfully separate confident closers from people who hedge or cave), not a certified test — and every visitor still sees the same encouraging result regardless of where they land in that range.

## Where this lives in the code

Everything above is defined in one place in `index.html`, inside the `<script>` block:

| Piece | Function / variable |
|---|---|
| The 3 positive keyword lists | `CUES` |
| The hedging/caving keyword list | `WEAK_CUES` |
| Per-reply 0–4 scoring, incl. the step-4/step-5 overrides | `messageEffort()` |
| Total → percentage mapping | `computePercent()` |
| Personality type selection | `pickResultKey()` and `topTrait()` |

Editing any of these directly changes what the quiz measures and how generously it scores — there's no separate config file or hidden logic elsewhere.
