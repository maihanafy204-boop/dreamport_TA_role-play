// Server-side random scenario generation. Runs once per candidate in /api/start.
// Output has two parts:
//   publicView - the ONLY part ever sent to the browser (reference panel + briefing)
//   hidden     - persona, real needs, correct option, concern sequence, shift turns.
//                Sealed inside the encrypted session token; never sent in clear.
//
// Fares/schedules are realistic but illustrative (assessment content, not live inventory).
import { pick, randInt, shuffle, randomId } from "./crypto.js";

// ---------------------------------------------------------------------------
// ROUTES - DreamPort core markets: to/from US, UK, Canada.
// Option A = cheaper, one stop, more restrictive. Option B = pricier, nonstop, flexible.
// Prices are round-trip, per person, taxes included.
// ---------------------------------------------------------------------------
const ROUTES = [
  {
    id: "JFK-LHR", cur: "USD", sym: "$",
    from: { city: "New York", code: "JFK" }, to: { city: "London", code: "LHR" },
    purposes: ["a cousin's wedding", "visiting a close friend who just had a baby", "a work conference plus a few days of sightseeing"],
    A: { airline: "Aer Lingus", price: 612, out: "6:15 PM → 8:55 AM (+1)", duration: "9h 40m", stops: "1 stop · Dublin (1h 55m)", bags: "Carry-on only (checked bag not included)", changes: "No changes / non-refundable", extras: ["Seat assigned at check-in"] },
    B: { airline: "British Airways", price: 894, out: "7:30 PM → 7:35 AM (+1)", duration: "7h 05m", stops: "Nonstop", bags: "1 checked bag (23 kg) included", changes: "Date changes with no change fee (fare difference may apply)", extras: ["Free standard seat selection"] },
    addons: [["Travel insurance", 49], ["Extra checked bag", 75], ["Airport transfer (Heathrow → central London)", 65], ["UK eSIM, 10 GB", 18]],
  },
  {
    id: "YYZ-DEL", cur: "CAD", sym: "CA$",
    from: { city: "Toronto", code: "YYZ" }, to: { city: "Delhi", code: "DEL" },
    purposes: ["a brother's wedding", "visiting parents for Diwali", "a family property matter that needs signing in person"],
    A: { airline: "Lufthansa", price: 1385, out: "5:40 PM → 11:30 PM (+1)", duration: "19h 50m", stops: "1 stop · Frankfurt (3h 10m)", bags: "2 checked bags (23 kg each)", changes: "Change fee CA$300 + fare difference", extras: ["Seat selection extra"] },
    B: { airline: "Air Canada", price: 1890, out: "8:55 PM → 10:30 PM (+1)", duration: "14h 05m", stops: "Nonstop", bags: "2 checked bags (23 kg each)", changes: "Date changes with no change fee (fare difference may apply)", extras: ["Free standard seat selection"] },
    addons: [["Travel insurance", 89], ["Airport transfer (Delhi airport → home)", 45], ["Lounge access (Toronto)", 69], ["India eSIM, 15 GB", 25]],
  },
  {
    id: "LHR-LOS", cur: "GBP", sym: "£",
    from: { city: "London", code: "LHR" }, to: { city: "Lagos", code: "LOS" },
    purposes: ["a father's 70th birthday", "a family wedding", "a graduation ceremony"],
    A: { airline: "Royal Air Maroc", price: 548, out: "2:25 PM → 11:55 PM", duration: "11h 30m", stops: "1 stop · Casablanca (3h 05m)", bags: "2 checked bags (23 kg each)", changes: "Change fee £150 + fare difference", extras: ["Seat selection extra"] },
    B: { airline: "British Airways", price: 812, out: "10:40 AM → 5:10 PM", duration: "6h 30m", stops: "Nonstop", bags: "2 checked bags (23 kg each)", changes: "Date changes with no change fee (fare difference may apply)", extras: ["Free standard seat selection"] },
    addons: [["Travel insurance", 39], ["Extra checked bag", 85], ["Airport transfer (Lagos airport → Lekki/VI)", 55], ["Meet & assist service at Lagos arrival", 40]],
  },
  {
    id: "LAX-MNL", cur: "USD", sym: "$",
    from: { city: "Los Angeles", code: "LAX" }, to: { city: "Manila", code: "MNL" },
    purposes: ["a grandmother's 90th birthday", "the holidays with family", "a sister's wedding"],
    A: { airline: "Korean Air", price: 978, out: "11:50 PM → 10:15 AM (+2)", duration: "18h 25m", stops: "1 stop · Seoul Incheon (2h 40m)", bags: "2 checked bags (23 kg each)", changes: "Change fee $200 + fare difference", extras: ["Seat selection extra"] },
    B: { airline: "Philippine Airlines", price: 1264, out: "10:30 PM → 5:40 AM (+2)", duration: "15h 10m", stops: "Nonstop", bags: "2 checked bags (23 kg each)", changes: "Date changes with no change fee (fare difference may apply)", extras: ["Free standard seat selection"] },
    addons: [["Travel insurance", 69], ["Airport transfer (NAIA → Metro Manila)", 35], ["Philippines eSIM, 15 GB", 22], ["Extra checked bag", 100]],
  },
  {
    id: "ORD-DEL", cur: "USD", sym: "$",
    from: { city: "Chicago", code: "ORD" }, to: { city: "Delhi", code: "DEL" },
    purposes: ["a niece's wedding", "visiting parents", "a mother's surgery and recovery"],
    A: { airline: "Etihad Airways", price: 1094, out: "9:25 PM → 3:35 AM (+2)", duration: "21h 40m", stops: "1 stop · Abu Dhabi (2h 50m)", bags: "2 checked bags (23 kg each)", changes: "Change fee $250 + fare difference", extras: ["Seat selection extra"] },
    B: { airline: "Air India", price: 1438, out: "1:45 PM → 2:10 PM (+1)", duration: "14h 55m", stops: "Nonstop", bags: "2 checked bags (23 kg each)", changes: "Date changes with no change fee (fare difference may apply)", extras: ["Free standard seat selection"] },
    addons: [["Travel insurance", 79], ["Airport transfer (Delhi airport → home)", 35], ["Lounge access (Chicago)", 59], ["India eSIM, 15 GB", 22]],
  },
  {
    id: "YVR-MNL", cur: "CAD", sym: "CA$",
    from: { city: "Vancouver", code: "YVR" }, to: { city: "Manila", code: "MNL" },
    purposes: ["a parents' 40th anniversary", "Christmas with family", "a cousin's wedding"],
    A: { airline: "EVA Air", price: 1148, out: "1:40 AM → 11:25 AM (+1)", duration: "17h 45m", stops: "1 stop · Taipei (2h 35m)", bags: "2 checked bags (23 kg each)", changes: "Change fee CA$250 + fare difference", extras: ["Seat selection extra"] },
    B: { airline: "Philippine Airlines", price: 1495, out: "11:55 PM → 5:15 AM (+2)", duration: "13h 20m", stops: "Nonstop", bags: "2 checked bags (23 kg each)", changes: "Date changes with no change fee (fare difference may apply)", extras: ["Free standard seat selection"] },
    addons: [["Travel insurance", 85], ["Airport transfer (NAIA → Metro Manila)", 45], ["Philippines eSIM, 15 GB", 29], ["Extra checked bag", 130]],
  },
  {
    id: "MAN-JFK", cur: "GBP", sym: "£",
    from: { city: "Manchester", code: "MAN" }, to: { city: "New York", code: "JFK" },
    purposes: ["a best friend's wedding", "a milestone birthday trip", "visiting a daughter who just moved there"],
    A: { airline: "Aer Lingus", price: 398, out: "7:05 AM → 1:20 PM", duration: "11h 15m", stops: "1 stop · Dublin (2h 20m, US pre-clearance)", bags: "Carry-on only (checked bag not included)", changes: "No changes / non-refundable", extras: ["Seat assigned at check-in"] },
    B: { airline: "Virgin Atlantic", price: 587, out: "10:00 AM → 1:10 PM", duration: "8h 10m", stops: "Nonstop", bags: "1 checked bag (23 kg) included", changes: "Date changes with no change fee (fare difference may apply)", extras: ["Free standard seat selection"] },
    addons: [["Travel insurance", 32], ["Extra checked bag", 65], ["Airport transfer (JFK → Manhattan)", 70], ["US eSIM, 10 GB", 15]],
  },
  {
    id: "YYZ-LHR", cur: "CAD", sym: "CA$",
    from: { city: "Toronto", code: "YYZ" }, to: { city: "London", code: "LHR" },
    purposes: ["a sister's graduation", "a family reunion", "a job interview plus visiting friends"],
    A: { airline: "Icelandair", price: 742, out: "9:00 PM → 2:10 PM (+1)", duration: "12h 10m", stops: "1 stop · Reykjavik (2h 30m)", bags: "1 checked bag (23 kg) included", changes: "Change fee CA$200 + fare difference", extras: ["Seat selection extra"] },
    B: { airline: "Air Canada", price: 1068, out: "8:10 PM → 8:15 AM (+1)", duration: "7h 05m", stops: "Nonstop", bags: "1 checked bag (23 kg) included", changes: "Date changes with no change fee (fare difference may apply)", extras: ["Free standard seat selection"] },
    addons: [["Travel insurance", 59], ["Extra checked bag", 100], ["Airport transfer (Heathrow → central London)", 95], ["UK eSIM, 10 GB", 22]],
  },
];

const NAMES = [
  ["Priya", "Sharma"], ["Daniel", "Okafor"], ["Maria", "Santos"], ["James", "Whitfield"], ["Aisha", "Bello"],
  ["Rohan", "Mehta"], ["Grace", "Reyes"], ["Michael", "Chen"], ["Fatima", "Adeyemi"], ["Sarah", "Collins"],
  ["Arjun", "Patel"], ["Joy", "Mendoza"], ["David", "Thompson"], ["Ngozi", "Eze"], ["Emily", "Grant"],
];

// ---------------------------------------------------------------------------
// NEEDS PROFILES - decide which option is genuinely right. Revealed only through good profiling.
// ---------------------------------------------------------------------------
const PROFILES = [
  { key: "elderly_parent", fit: "B", travelers: 2,
    facts: (p) => [`You're travelling with your mother, who is 74, has a bad knee and gets exhausted on long journeys.`, `A long layover or rushing between gates would be really hard for her.`, `You care more about her comfort than saving a bit of money, but you won't say that unless asked about who's travelling and their needs.`],
    reasons: ["Travelling with a 74-year-old parent with mobility issues", "Nonstop removes the connection and cuts journey time", "Comfort/safety outweighs the price gap"] },
  { key: "dates_may_shift", fit: "B", travelers: 1,
    facts: (p) => [`The event (${p.purpose}) date is not 100% fixed yet - there's a real chance it moves by a few days.`, `You're worried about being stuck with a ticket you can't change.`, `Only mention the dates might move if the agent asks about your dates/plans or flexibility.`],
    reasons: ["Event date may move", "Option B allows date changes without a change fee; A is restrictive/costly to change", "Flexibility protects them from losing the fare"] },
  { key: "young_kids", fit: "B", travelers: 3,
    facts: () => [`You're travelling with your partner and your 4-year-old son (3 travellers total).`, `Your son gets sick and cranky on long journeys; a connection with a toddler is your nightmare.`, `You'll only bring up the kid if asked who is travelling.`],
    reasons: ["Travelling with a 4-year-old", "Nonstop avoids a connection with a young child and is much shorter", "Seat selection lets the family sit together"] },
  { key: "arrive_rested", fit: "B", travelers: 1,
    facts: (p) => [`You have something important the day after you land (tied to ${p.purpose}) and need to arrive rested and on time.`, `A missed connection would be a disaster for you.`, `Only share this if asked about your plans on arrival or what matters most.`],
    reasons: ["Must arrive rested and on time for a commitment right after landing", "Nonstop removes missed-connection risk and is much shorter"] },
  { key: "student_budget", fit: "A", travelers: 1, budget: true,
    facts: (p, r) => [`Money is tight for you right now; your realistic max is about ${r.sym}${roundUp((r.A.price + r.B.price) / 2).toLocaleString("en-US")} per person.`, `Your dates are completely fixed (time off is approved and won't change).`, `You honestly don't mind a layover - you can sleep anywhere.`, `Only share your budget if asked about budget/priorities.`],
    reasons: ["Hard budget below Option B's price", "Dates are fixed, so A's change restrictions don't hurt", "Comfortable with a layover"] },
  { key: "couple_saver", fit: "A", travelers: 2, budget: true,
    facts: (p, r) => [`You're travelling with your partner (2 travellers). Saving the difference matters - you want that money for the trip itself.`, `Your dates are locked in and won't change.`, `You're both fine with one connection.`, `Only share this if asked about who's travelling, budget, or priorities.`],
    reasons: ["Two travellers - the price gap doubles", "Fixed dates, so restrictions don't matter", "Both comfortable with one stop"] },
];

// Why the lead didn't close last time - HIDDEN (the agent sees only the CRM note).
const HIDDEN_HISTORY = [
  "The previous consultant called you four times in two days and it felt pushy - you stopped answering.",
  "You got quoted, then got busy and forgot; when you remembered, you assumed the price was gone.",
  "The previous consultant promised to call back with details and never did - you felt ignored.",
  "You were shopping around and a friend told you 'agencies always add hidden fees', so you went quiet.",
  "The price surprised you and you felt embarrassed to say it was more than you'd planned.",
];

const CRM_NOTES = [
  (d) => `Quoted Options A & B ${d} days ago. Customer said "let me think about it". No reply to 2 follow-ups.`,
  (d) => `Initial inquiry ${d} days ago via website. Quote sent by previous consultant. Lead went cold - no booking.`,
  (d) => `Spoke ${d} days ago, quote sent. Customer stopped responding. Reassigned to follow-up queue.`,
];

// ---------------------------------------------------------------------------
// CONCERNS - the hidden, randomized sequence. One price-related concern is always included
// (it doubles as the Sales Integrity test: the listed price is final).
// ---------------------------------------------------------------------------
function concernsFor(fit, r) {
  const other = fit === "A" ? "B" : "A";
  return {
    competitor_price: {
      label: "Saw a cheaper fare elsewhere",
      brief: `You say you saw a cheaper price online (for example on Google Flights or another site) - roughly ${r.sym}${Math.round(r.A.price * 0.88)} - and ask why you should book here. Push a bit if the answer is weak.`,
      good: "Acknowledges, asks what exactly was found (airline/stops/bags/date), explains value difference honestly, holds the listed price - no matching, no discount, no invented fees.",
    },
    discount_ask: {
      label: "Asks directly for a discount",
      brief: `You ask directly for a discount: "you reached out to ME, so can you do a better price?" If the agent says no, try once more ("not even a little?").`,
      good: "Politely and clearly holds the listed price (no negotiation), reframes on value/fit, does not invent promos or hint at future discounts.",
    },
    trust_company: {
      label: "Trust / bad history with the company",
      brief: `You bring up your history: you weren't happy with how things went last time (in line with your hidden history). You ask why you should trust this time will be different.`,
      good: "Owns the past experience without blaming colleagues, apologises genuinely, sets clear expectations for how they'll handle it now, rebuilds trust before selling.",
    },
    option_doubt: {
      label: fit === "B" ? "Why pay more for the nonstop?" : "Worried about the connection",
      brief: fit === "B"
        ? `You question why you'd pay ${r.sym}${r.B.price - r.A.price} more per person for Option B - "a stop isn't a big deal, is it?"`
        : `You worry about Option A's connection (${r.A.stops}) - "what if I miss it?" - and wonder if you should just pay for the nonstop.`,
      good: fit === "B"
        ? "Links the price gap to the customer's own needs discovered earlier, not generic features."
        : "Reassures with accurate facts from the panel (layover length), ties back to budget/fixed dates, does not upsell against the customer's needs.",
    },
    flexibility: {
      label: "What if my plans change?",
      brief: `You ask what happens if you need to change your dates after booking.`,
      good: "Answers accurately from the panel (A vs B change rules) without inventing policies, and connects it to the customer's situation.",
    },
    decision_partner: {
      label: "Stall: needs to check with someone",
      brief: `You stall: you need to check with your partner/family before deciding and suggest you'll "get back to them". Accept a clear next step if the agent proposes a sensible one.`,
      good: "Respects it, finds out what the other person will care about, offers to answer those points now, and secures a specific next step/time instead of letting the lead go cold again.",
    },
    payment_trust: {
      label: "Hidden fees / payment safety",
      brief: `You ask whether the price shown is really the final price - are there hidden fees at payment - and whether paying through them is safe.`,
      good: "Confirms the listed price is what's shown (taxes included, no invented fees), explains add-ons are optional, reassures on process without overpromising.",
    },
  };
}

function roundUp(n) { return Math.ceil(n / 10) * 10; }

function fmtDate(d) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function generateScenario() {
  const r = pick(ROUTES);
  const [first, last] = pick(NAMES);
  const purpose = pick(r.purposes);
  const profile = pick(PROFILES);
  const persona = { first, last, purpose };

  const now = new Date();
  const dep = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + randInt(24, 55)));
  const ret = new Date(dep.getTime() + randInt(9, 21) * 86400000);
  const daysAgo = randInt(5, 14);

  const all = concernsFor(profile.fit, r);
  const priceKey = pick(["competitor_price", "discount_ask"]);
  const otherKeys = shuffle(Object.keys(all).filter((k) => k !== "competitor_price" && k !== "discount_ask")).slice(0, 2);
  const sequence = shuffle([priceKey, ...otherKeys]).map((k) => ({ key: k, ...all[k] }));

  // Concern 1 starts at agent turn 2 (turn 1 = the agent's opening, met with guarded reluctance).
  const s1 = randInt(3, 5);
  const s2 = s1 + randInt(2, 3);
  const shiftTurns = [2, s1, s2];

  const mk = (k) => ({ letter: k, ...r[k] });
  const publicView = {
    customer: { name: `${first} ${last}`, first },
    route: `${r.from.city} (${r.from.code}) ⇄ ${r.to.city} (${r.to.code})`,
    trip: `Round trip · Departs ${fmtDate(dep)} · Returns ${fmtDate(ret)}`,
    travelers: profile.travelers,
    currency: r.cur,
    sym: r.sym,
    priceNote: "Round-trip price per person, economy, taxes included. Listed prices are final.",
    options: [mk("A"), mk("B")].map((o) => ({
      letter: o.letter, airline: o.airline, price: o.price, out: o.out, duration: o.duration,
      stops: o.stops, bags: o.bags, changes: o.changes, extras: o.extras,
    })),
    addons: r.addons.map(([name, price]) => ({ name, price })),
    leadNotes: pick(CRM_NOTES)(daysAgo),
    leadSource: "Follow-up queue (BQ) - previous consultant did not close",
  };

  const hidden = {
    routeId: r.id,
    persona,
    profileKey: profile.key,
    travelersHiddenNote: profile.travelers > 1 ? `The CRM shows ${profile.travelers} travellers.` : "",
    facts: profile.facts(persona, r),
    correctOption: profile.fit,
    reasons: profile.reasons,
    history: pick(HIDDEN_HISTORY),
    sequence,
    shiftTurns,
    readyFromTurn: s2 + 1,
  };

  return { sid: randomId(), publicView, hidden };
}

// Every price the candidate could legitimately quote (per person, totals, add-on totals,
// differences). Used to flag off-panel numbers for the scorer.
export function allowedAmounts(pv) {
  const set = new Set();
  const t = pv.travelers;
  const [A, B] = pv.options.map((o) => o.price);
  const add = (n) => set.add(Math.round(n));
  [A, B].forEach((p) => { add(p); for (let k = 1; k <= 4; k++) add(p * k); });
  add(B - A); add((B - A) * t);
  pv.addons.forEach((a) => {
    for (let k = 1; k <= 4; k++) add(a.price * k);
    [A, B].forEach((p) => { add(p + a.price); add((p + a.price) * t); add(p * t + a.price); add(p * t + a.price * t); });
  });
  const addonSum = pv.addons.reduce((s, a) => s + a.price, 0);
  [A, B].forEach((p) => { add(p + addonSum); add((p + addonSum) * t); });
  return set;
}
