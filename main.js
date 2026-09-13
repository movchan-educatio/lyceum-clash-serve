import { defineRoom, defineServer } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LyceumClashRoom } from "./rooms/LyceumClashRoom.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testPage = readFileSync(join(__dirname, "../public/test.html"), "utf8");

const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
const port = Number(process.env.PORT || 2567);

const server = defineServer({
  transport: new WebSocketTransport({
    pingInterval: 10000,
    pingMaxRetries: 4,
  }),

  rooms: {
    lyceum_clash: defineRoom(LyceumClashRoom),
  },

  express: (app) => {
    app.use((req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
      next();
    });

    app.get("/", (_req, res) => {
      res.type("text/plain").send(
        "LYCEUM CLASH multiplayer server is online. Open /test for the 2-device test."
      );
    });

    app.get("/health", (_req, res) => {
      res.json({
        ok: true,
        service: "lyceum-clash-server",
        transport: "colyseus-websocket",
        version: "1.0.0",
        now: Date.now(),
      });
    });

    app.get("/test", (_req, res) => {
      res.type("html").send(testPage);
    });
  },
});

await server.listen(port);
console.log(`LYCEUM CLASH server listening on 0.0.0.0:${port}`);
