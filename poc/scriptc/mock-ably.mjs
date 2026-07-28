// Minimal Ably-REST-shaped endpoint, so the native binary can be exercised
// end-to-end without reaching the real service.
import http from "node:http";

const store = [];

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = req.url ?? "";
    if (url.startsWith("/time")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([Date.now()]));
      return;
    }
    if (req.method === "POST" && url.includes("/messages")) {
      const parsed = JSON.parse(body);
      const msgs = Array.isArray(parsed) ? parsed : [parsed];
      for (const m of msgs) store.unshift(m);
      console.error(`[mock-ably] received publish: ${JSON.stringify(msgs)}`);
      res.writeHead(201, { "content-type": "application/json" });
      res.end("{}");
      return;
    }
    if (req.method === "GET" && url.includes("/messages")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(store));
      return;
    }
    res.writeHead(404);
    res.end("{}");
  });
});

server.listen(8765, "127.0.0.1", () => console.error("[mock-ably] listening on 8765"));
