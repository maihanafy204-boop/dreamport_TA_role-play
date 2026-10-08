// Local dev server that mimics Vercel: serves /public statically and routes /api/* to the
// handlers. Usage:  SESSION_SECRET=... ANTHROPIC_API_KEY=... node scripts/dev-server.js
// (or MOCK_AI=1 SESSION_SECRET=devsecretdevsecret node scripts/dev-server.js for a no-cost dry run)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const handlers = {
  "/api/start": (await import("../api/start.js")).default,
  "/api/chat": (await import("../api/chat.js")).default,
  "/api/finish": (await import("../api/finish.js")).default,
};
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (handlers[url.pathname]) return handlers[url.pathname](req, res);
  const p = path.normalize(path.join(pub, url.pathname === "/" ? "index.html" : url.pathname));
  if (!p.startsWith(pub) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.statusCode = 404; return res.end("Not found"); }
  res.setHeader("Content-Type", TYPES[path.extname(p)] || "application/octet-stream");
  fs.createReadStream(p).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log("http://localhost:" + (process.env.PORT || 3000)));
