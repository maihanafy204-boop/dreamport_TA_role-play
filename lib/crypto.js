// AES-256-GCM sealed session tokens. The browser only ever holds an opaque ciphertext;
// the scenario, hidden concern sequence, answer key and transcript live inside it and
// cannot be read or modified without SESSION_SECRET (GCM auth tag rejects tampering).
import crypto from "node:crypto";
import zlib from "node:zlib";
import { CONFIG } from "./config.js";

function key() {
  return crypto.createHash("sha256").update("dp-chat-v2:" + CONFIG.sessionSecret).digest();
}

export function seal(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const plain = zlib.deflateRawSync(Buffer.from(JSON.stringify(obj), "utf8"));
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function unseal(token) {
  if (typeof token !== "string" || token.length < 40 || token.length > 200000) throw new Error("bad token");
  const buf = Buffer.from(token, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(zlib.inflateRawSync(plain).toString("utf8"));
}

export const randomId = () => crypto.randomBytes(9).toString("base64url");

// Cryptographically random helpers for scenario generation.
export const randInt = (min, max) => crypto.randomInt(min, max + 1);
export const pick = (arr) => arr[crypto.randomInt(0, arr.length)];
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
