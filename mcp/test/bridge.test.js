import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import WebSocket from "ws";
import { startBridge } from "../src/bridge.js";
import { SidebarLink, NO_SIDEBAR } from "../src/link.js";

const until = async (fn, ms = 2000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error("timeout"); await sleep(10); } };
const connect = (port, origin) => new WebSocket(`ws://127.0.0.1:${port}`, { origin });
const connectPeer = (port, origin) => new WebSocket(`ws://127.0.0.1:${port}`, "appsheet-copilot-peer", origin ? { origin } : {});

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

test("a second helper becomes a peer and its calls reach the sidebar through the hub", async () => {
  const hubLink = new SidebarLink();
  const hub = startBridge({ port: 0, link: hubLink });
  await until(() => hub.listening);
  const sidebar = connect(hub.port, "moz-extension://abcd");
  sidebar.on("message", (d) => { const m = JSON.parse(String(d)); sidebar.send(JSON.stringify({ type: "result", id: m.id, ok: true, result: { tool: m.tool } })); });
  await until(() => hubLink.connected);

  const second = startBridge({ port: hub.port, link: new SidebarLink(), retryMs: 50 });
  await until(() => second.mode === "peer");
  assert.deepEqual(await second.call("appsheet_get_app", {}, 1000), { tool: "appsheet_get_app" });

  sidebar.close(); second.close(); hub.close();
});

test("hub errors reach the peer verbatim", async () => {
  const hub = startBridge({ port: 0, link: new SidebarLink() });
  await until(() => hub.listening);
  const second = startBridge({ port: hub.port, link: new SidebarLink(), retryMs: 50 });
  await until(() => second.mode === "peer");
  await assert.rejects(second.call("appsheet_get_app", {}, 1000), { message: NO_SIDEBAR });
  second.close(); hub.close();
});

test("a web page can't pose as a peer", async () => {
  const b = startBridge({ port: 0, link: new SidebarLink() });
  await until(() => b.listening);
  const status = await new Promise((resolve) => connectPeer(b.port, "https://evil.example").on("unexpected-response", (_req, res) => resolve(res.statusCode)));
  assert.equal(status, 403);
  b.close();
});

test("when the hub exits, the peer takes over as hub", async () => {
  const first = startBridge({ port: 0, link: new SidebarLink() });
  await until(() => first.listening);
  const second = startBridge({ port: first.port, link: new SidebarLink(), retryMs: 50 });
  await until(() => second.mode === "peer");
  first.close();
  await until(() => second.mode === "hub", 3000);
  assert.equal(second.listening, true);
  second.close();
});
