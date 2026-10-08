# DreamPort — Travel Consultant Chat Assessment (v2)

A private, AI-powered **written** role-play for screening Travel Consultant candidates. Same business context as the voice-based DreamPort assessment: the candidate picks up a **follow-up-queue (BQ) lead** that a previous consultant couldn't close. Only the channel is different: chat, not voice.

> v2 replaces the public "Customer Chat Challenge" ad quiz (keyword scoring, score shown to the visitor). The DreamPort visual identity is kept. Everything else is new.

## Candidate flow

1. **Email address** (required, validated in the browser and on the server; stored lower-case and used as the candidate identifier on the Teams card). An access code is also required if `ASSESSMENT_ACCESS_CODE` is set.
2. **Briefing.** The situation (BQ lead), the goal (re-engage, profile, recommend, close) and the rules (two fixed options, listed price is final, recommend based on needs, no invented facts). Nothing in the briefing mentions that the customer's concerns will shift.
3. **Chat.** The candidate writes first. An AI customer replies. A **reference panel** stays next to the chat the whole time (on mobile it is a one-tap bar above the chat). It shows the customer, the trip, the CRM note, both options (airline, price, schedule, stops, bags, change rules) and the priced add-ons. There's a 15-minute timer. Paste is blocked and paste attempts are counted.
4. **Chat ends** when the customer books, agrees a follow-up or leaves, when time runs out, at the turn cap, or when the candidate ends it.
5. **End screen.** No score is ever shown.
   - **Passed** → "You're exactly who we're looking for… join us" + **Apply** link
   - **Not ready yet** → "Not quite ready yet… we offer free training" + **Start your free training** + **Apply** link
   - **Neutral** (only if scoring fails) → thank-you + **Apply** link

   Apply link: `https://www.dreamport.me/en?utm_source=role+play` (`APPLY_URL`). If `TRAINING_URL` is set, the training button uses that link and Apply appears as a second button. If it isn't set, one combined button is shown.

## What the recruiter gets (Microsoft Teams)

One Adaptive Card per candidate, posted to a channel. It includes:

- the candidate's email (clickable)
- the decision (ADVANCE / REVIEW / REJECT / INCOMPLETE) and the reason
- the overall score, plus the communication and sales sub-scores
- all 8 dimensions with their scores and 1–2 sentence feedback
- the Sales Integrity result, with verbatim quotes for any violation
- the option the candidate recommended vs. the correct option
- how the candidate handled the concern shift
- the route and the hidden concern sequence
- turns, duration and paste attempts
- a **Show transcript** button

If Teams is unreachable after 3 retries, the full result JSON is written to the Vercel logs (`RESULT_JSON=`), so no result is lost.

## Architecture & security

```
public/index.html      static UI. Receives ONLY the public scenario view + an encrypted token
api/start.js           validates candidate → generates random scenario → seals session
api/chat.js            unseals → builds customer prompt for this turn → Anthropic → reseals
api/finish.js          unseals → AI scoring → verification → gates → Teams → returns "pass"/"training"
lib/scenario.js        routes, fares, personas, needs profiles, concern pool (server only)
lib/prompts.js         customer + scorer prompts (server only)
lib/scoring.js         weights, evidence verification, gates, decision
lib/crypto.js          AES-256-GCM sealed tokens
lib/store.js           anti-replay + one-result-per-session (Upstash Redis, optional)
lib/teams.js           Adaptive Card + webhook
```

- **Nothing sensitive reaches the browser.** The persona, the hidden needs, the correct option, the concern sequence, the shift turns and all prompts live in `/lib`. `vercel.json` sets `outputDirectory: "public"`, so only `/public` is served. The session travels as an AES-256-GCM ciphertext: DevTools shows an opaque string, and any tampering is rejected.
- **The server controls the concern shift.** Each turn, the server works out which concern is active and rebuilds the customer prompt. The model can't drift off the hidden sequence, and the candidate can't see or influence it.
- **Anti-replay.** With Upstash configured, each session's turn counter is kept server-side. Resending an old token to retry a message gets HTTP 409, and each session produces exactly one Teams card. Without Upstash this is only best-effort, because serverless instances don't share memory. **Set Upstash up before going live** (the free tier is enough).
- **The scorer can't make things up.** Every evidence quote and every integrity violation is checked against the candidate's actual messages. Anything that isn't a verbatim match is dropped, and the drop count is shown on the card. A hallucinated violation can't reject a candidate.

## Setup (≈15 minutes)

1. **Teams webhook.** In the target channel: **⋯ → Workflows → "Post to a channel when a webhook request is received"**. Finish the wizard and copy the URL.
2. **Upstash (recommended).** Go to upstash.com, create a free Redis database and copy the REST URL and token. Or add it from the Vercel Marketplace.
3. **Deploy.** Push this folder to GitHub and import it in Vercel. Framework preset: **Other**. No build command.
4. **Environment variables** (Vercel → Settings → Environment Variables). See `.env.example`:
   - required: `ANTHROPIC_API_KEY`, `SESSION_SECRET` (32+ random characters), `TEAMS_WEBHOOK_URL`
   - recommended: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ASSESSMENT_ACCESS_CODE`
   - optional: `TRAINING_URL`, `REVIEW_SHOWS_AS`, `PASS_THRESHOLD`, `REVIEW_THRESHOLD`, `COMM_FLOOR`, `MAX_AGENT_TURNS`, `TIME_LIMIT_MINUTES`, model names
5. **Redeploy**, then run 2–3 test chats yourself and check the Teams cards.
6. **Security check:** `https://<your-app>/lib/prompts.js` must return 404.

### Local testing

```bash
# Free dry run with mocked AI and Teams (prints the result to the console):
MOCK_AI=1 SESSION_SECRET=devsecretdevsecret npm run dev     # http://localhost:3000
MOCK_AI=1 SESSION_SECRET=devsecretdevsecret npm run smoke   # in a 2nd terminal: automated checks
# Real AI locally:
ANTHROPIC_API_KEY=... SESSION_SECRET=... TEAMS_WEBHOOK_URL=... npm run dev
```

The smoke test checks that:
- a valid email is required
- no hidden fields are in the public payload
- replayed tokens and tampered tokens are both rejected
- a second finish is never re-scored
- no score reaches the browser
- `/lib` and `/api` source files are not served

## Cost

Rough estimate: 8–14 customer turns plus one scoring call is about 25–40k input tokens per candidate. On a Sonnet-class model that's roughly **$0.10–0.20 per candidate**. Use the access code so random visitors can't spend credit.

## Editing content

All in `lib/scenario.js`:

- `ROUTES` — 8 US/UK/Canada routes with real carriers. Fares and schedules are realistic but illustrative.
- `PROFILES` — the 6 hidden needs profiles, which decide whether A or B is correct.
- `HIDDEN_HISTORY` — why the lead went cold (hidden from the candidate).
- `CRM_NOTES` — the note the candidate does see.
- `concernsFor()` — the 7-concern pool. Each scenario gets one price concern (which doubles as the integrity test) plus 2 random others, in random order. The shifts happen at random turns.

The rubric and the gates are in `lib/prompts.js` and `lib/scoring.js`. See `EVALUATION-CRITERIA.md` (internal only — never share it with candidates).
