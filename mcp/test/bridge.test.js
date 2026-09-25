import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import WebSocket from "ws";
import { startBridge } from "../src/bridge.js";
import { SidebarLink } from "../src/link.js";

const until = async (fn, ms = 2000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error("timeout"); await sleep(10); } };
const connect = (port, origin) => new WebSocket(`ws://127.0.0.1:${port}`, { origin });

test("rejects a web page origin with 403", async () => {
  const b = startBridge({ port: 0, link: new SidebarLink() });
  await until(() => b.listening);
  const status = await new Promise((resolve) => connect(b.port, "https://evil.example").on("unexpected-response", (_req, res) => resolve(res.statusCode)));
  assert.equal(status, 403);
  b.close();
});

test("accepts a moz-extension origin and relays a call", async () => {
  const link = new SidebarLink();
  const b = startBridge({ port: 0, link });
  await until(() => b.listening);
  const ws = connect(b.port, "moz-extension://abcd");
  ws.on("message", (d) => { const m = JSON.parse(String(d)); ws.send(JSON.stringify({ type: "result", id: m.id, ok: true, result: { tool: m.tool } })); });
  await until(() => link.connected);
  assert.deepEqual(await link.call("appsheet_get_app", {}, 1000), { tool: "appsheet_get_app" });
  ws.close(); b.close();
});

test("a second helper on a busy port waits, then takes over", async () => {
  const first = startBridge({ port: 0, link: new SidebarLink() });
  await until(() => first.listening);
  const second = startBridge({ port: first.port, link: new SidebarLink(), retryMs: 50 });
  await sleep(150);
  assert.equal(second.listening, false);
  first.close();
  await until(() => second.listening);
  second.close();
});
