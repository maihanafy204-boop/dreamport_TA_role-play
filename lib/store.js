// Optional anti-replay store. With Upstash Redis configured, each session's turn counter
// lives server-side, so a candidate cannot resend an older token to "retry" a message,
// and a session can only produce ONE result. Without it, a per-instance in-memory map is
// used (best effort only - serverless instances don't share memory).
import { CONFIG } from "./config.js";

const mem = new Map();
const TTL = 60 * 60 * 6; // 6h

async function upstash(cmd) {
  const r = await fetch(CONFIG.upstashUrl, {
    method: "POST",
    headers: { Authorization: "Bearer " + CONFIG.upstashToken, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error("upstash " + r.status);
  return (await r.json()).result;
}
const useRedis = () => !!(CONFIG.upstashUrl && CONFIG.upstashToken);

export async function getTurn(sid) {
  if (useRedis()) {
    const v = await upstash(["GET", "dp:turn:" + sid]);
    return v === null ? null : Number(v);
  }
  return mem.has("turn:" + sid) ? mem.get("turn:" + sid) : null;
}

export async function setTurn(sid, turn) {
  if (useRedis()) return upstash(["SET", "dp:turn:" + sid, String(turn), "EX", String(TTL)]);
  mem.set("turn:" + sid, turn);
}

// Returns true only the first time it is called for a session.
export async function claimFinish(sid) {
  if (useRedis()) return (await upstash(["SET", "dp:done:" + sid, "1", "NX", "EX", String(TTL)])) === "OK";
  if (mem.has("done:" + sid)) return false;
  mem.set("done:" + sid, 1);
  return true;
}

export const storeMode = () => (useRedis() ? "redis" : "memory");
