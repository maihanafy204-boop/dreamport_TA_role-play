# DreamPort — Customer Chat Challenge

A free, public-facing text-chat quiz for recruitment ad landing pages (Meta/Google). It is intentionally separate from the private hiring assessment tool — this one is scripted, fun, and shows the result immediately.

## What it is

- One self-contained file: `index.html`. No build step, no dependencies, no server.
- A hand-written 5-step branching text conversation with a fictional customer, "Mia," booking a Santorini trip. You genuinely type your own replies in a real text box — nothing is picked from a list. Mia's incoming messages are still pre-written (a "warm" and a "brisk" variant per step), and the quiz picks between them locally based on a plain-language read of what you typed (see "How the scoring works" below). There are no live AI/API calls, so it costs nothing to run at any volume, however many people click the ad.
- A collapsible "📋 View flight options for Mia's trip" panel sits above the chat, visible throughout all 5 steps — two flight options (price, times, a few feature bullets each) plus a line of optional add-ons, so replies like "I'd recommend Option B" have something real behind them instead of being typed blind. It mirrors the persistent reference panel in the real assessment tool, just with fictional airlines instead of real ones (this version is public-facing ad content, so it doesn't reuse real airline names/trademarks the way the internal tool does).
- After the 5th reply, a short "enter your name and email to see your result" gate appears — the result isn't shown until that's submitted (both fields required, basic email format check). Right after submitting, the entry is written to a Google Sheet (see below) and the result appears immediately.
- The result screen is one clear number: a big "Consultant Score" percentage in a circular meter, with a one-line caption stating exactly what it's based on, plus a short personality-type badge (The Rising Star / The Relationship Builder / The Natural Closer / The Complete Consultant) for flavor, a "Copy my result to share" button, and an "Apply now" CTA.
- Visual identity (logomark, indigo/coral/gold palette, lavender background, card style, serif headlines) is pulled directly from the live DreamPort Role-Play Assessment tool, so it reads as the same family, just the public, lighter-touch version.

## How the scoring works (and exactly what it evaluates)

There's no live AI reading what people type — that would reintroduce the exact per-response cost this whole approach is built to avoid. Instead, each typed reply is scanned locally (in the browser, instantly, for free) against three short keyword/phrase lists — Empathy, Confidence, Closing — in the `CUES` object near the top of the `<script>` block (e.g. "understand," "sorry," or a question mark lean empathy; "definitely," "recommend," "worth it," "!" lean confidence; "book," "let's do this," "ready" lean closing), plus a fourth list, `WEAK_CUES`, of hedging/passive/price-caving phrases ("I guess," "whatever you want," "I can give you a discount," "match that price"...) that works against the score instead of for it.

Each of the 5 replies earns 0–4 points: +1 for each of the 3 positive categories it hits, +1 flat if it's a real sentence (15+ characters) rather than a one- or two-word filler, then −1 per hedging/caving phrase hit (up to −2). **This is the entire evaluation** — there is no hidden bonus for just having replied, and a generic reply like "ok" or "sure thing" that hits no category and isn't a real sentence legitimately scores 0 for that message.

Two of the five steps are graded harder, on purpose, because they're a lighter version of the same two moments the private assessment tool weighs most heavily — caving on price at the first objection, and never actually asking for the close:
- **Step 4** (the customer says a friend found a cheaper flight): any hedging/caving language in the reply zeroes that message outright, full stop. Defending the value of the pricier option — without offering a discount — keeps full credit.
- **Step 5** (the customer asks "what happens next?"): the same override applies, and a reply with zero closing-language ("book," "confirm," "next step"...) is capped at 2 of 4 points even if it reads warm or confident, because sounding good isn't the same as asking for the booking.

This means the score and the spreadsheet row now meaningfully separate someone who defends value and closes from someone who folds at the first pushback or lets the moment pass — while every visitor still sees the exact same encouraging 5–98% range and flavor text either way (see below).

The 5 per-message scores (0–20 total) map onto a 5–98% displayed score — `computePercent()`, one line, right below the scoring functions. It isn't a literal 0–100 scale only to avoid a jarring "0%"/"100%" on what's still a fun ad quiz rather than a certified test; everything in between is a genuine, discriminating read of the 5 replies, not padded, and nobody sees a harsher-looking result on screen just because the logic behind it got stricter. The result screen also states this plainly to the visitor ("Based on empathy, confidence, and closing language across your 5 replies") plus which trait scored highest, so nobody's left wondering what the number means. The dominant trait across all 5 replies (unaffected by the hedging penalty) also picks which of the four personality types shows up, mostly for flavor and shareability.

Worth being upfront about: this is still a lightweight keyword heuristic, not real language understanding — a sarcastic or oddly-phrased reply can still land in the wrong bucket, and it's more resistant to gaming than the first version of this quiz but not immune to it (stacking positive-category words while avoiding the hedging list still scores well). If you ever want it to be a more rigorous read of what someone actually said, that means either a live AI call per reply (which brings back real per-response cost) or a much larger local rules engine — either is a bigger lift than this quiz's "free, disposable ad landing page" scope calls for. The real, rigorous evaluation is what the private assessment tool is for; this is a useful first filter, not a replacement for it. Full detail on every rule lives in `EVALUATION-CRITERIA.md`.

## Before you launch this as an ad

"Apply now" is already wired to `https://www.dreamport.me/en?utm_source=role+play`. Three other things in `index.html` are still placeholders — search for `TODO` / `REPLACE`:

1. **Share link** (used by the "Copy my result to share" button):
   ```js
   var SHARE_URL = "https://REPLACE-ME.dreamport.example/customer-chat-challenge";
   ```
   Set this once you know the quiz's live URL.

2. **Spreadsheet endpoint** — this is how the name/email + result gets into a spreadsheet. See "Wiring up the spreadsheet" below.

3. **Analytics** — there's a comment near the top of `<head>` marking where to paste a Meta Pixel / Google Ads conversion tag, if you want to track quiz completions/clicks as ad conversions.

4. **Social preview image** — the `og:title` / `og:description` tags are filled in, but there's no `og:image` yet. Add a 1200×630 image and an `og:url` once it's deployed, so shared links show a nice preview card.

## Wiring up the spreadsheet

The page is fully static (that's what keeps it free to run), so it can't talk to a spreadsheet on its own — it needs a tiny free "receiving end." The standard zero-cost way to do that with Google Sheets is a Google Apps Script Web App bound to the sheet. Takes about 5 minutes, one time, and nobody needs to touch code again after that:

1. Create a new Google Sheet (or open the one you want results in). Add a header row: `Timestamp | Name | Email | Type | Score | Confidence | Empathy | Closing Instinct | Path`.
2. In that sheet, go to **Extensions → Apps Script**. Delete whatever's in the editor and paste this:
   ```js
   function doPost(e) {
     var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     var data = JSON.parse(e.postData.contents);
     sheet.appendRow([
       new Date(),
       data.name || "",
       data.email || "",
       data.type || "",
       data.score,
       data.confidence,
       data.empathy,
       data.closing,
       data.path || ""
     ]);
     return ContentService.createTextOutput(JSON.stringify({ ok: true }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```
3. Click **Deploy → New deployment**. Type: **Web app**. Execute as: **Me**. Who has access: **Anyone**. Click **Deploy**, then authorize it when Google prompts you (it's your own script, on your own sheet — the "Google hasn't verified this app" warning is expected for a personal script like this; click through it via **Advanced**).
4. Copy the `.../exec` URL it gives you.
5. Paste it into `index.html`:
   ```js
   var SHEET_ENDPOINT = "https://script.google.com/macros/s/PASTE-YOUR-ID-HERE/exec";
   ```

Until that's set, the quiz still works end-to-end — it just logs the row to the browser console instead of writing it anywhere, so testing before you've set this up won't break.

`path` is a bonus column: it's the sequence of dominant traits across the five replies (e.g. `emp>emp>conf>close>close`) — useful if you ever want a sense of *how* someone got to their result, not just what they got. The actual text people typed isn't sent to the sheet by default (keeps the row simple and avoids unmoderated public text landing in a shared company sheet) — easy to add via the `payload` object in the `btn-reveal` click handler if you'd rather have it.

## Deploying (free)

**GitHub Pages**
1. Push this folder to a GitHub repo.
2. Repo Settings → Pages → Deploy from branch → pick `main` and `/ (root)`.
3. Your quiz is live at `https://<you>.github.io/<repo>/`.

**Vercel**
1. `npm i -g vercel` (one-time), then from this folder run `vercel`.
2. Accept the defaults — it's a static site, no build command needed.
3. Vercel gives you a free `*.vercel.app` URL immediately.

Either way, there's nothing to configure at runtime — it's just static HTML/CSS/JS.

## Editing the content

Everything content-wise lives near the top of the `<script>` block in `index.html`:

- `TREE` holds the 5 steps. Each step (after the first) has a `warm` and a `brisk` variant of Mia's line, plus a `hint` shown as the input's placeholder text.
- `CUES` holds the positive keyword patterns used to read each typed reply; `WEAK_CUES` holds the hedging/caving patterns that dock credit instead. The step-4/step-5 sharper rules live inside `messageEffort()`, keyed off `nodeId`.
- `RESULTS` holds the four personality outcomes and their blurbs — shown as flavor under the score, chosen by whichever trait came out on top across the five replies (a near-tie shows the balanced "Complete Consultant" result instead).
- The flight-option reference panel is plain HTML in the `screen-quiz` section (look for `id="ref-panel"`) — edit the prices, airline names, or feature bullets directly there.

No React, no build tooling — it's plain HTML/CSS/JS, so any front-end-comfortable person on the team can tweak copy directly.
