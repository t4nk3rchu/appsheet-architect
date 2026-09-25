import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { createServer } from "node:http";
import WebSocket from "ws";
import { startBridge, MOVED } from "../src/bridge.js";
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

test("a moz-extension origin claiming the peer subprotocol never reaches the peer handler", async () => {
  const link = new SidebarLink();
  const b = startBridge({ port: 0, link });
  await until(() => b.listening);
  // A real add-on origin, but requesting the peer subprotocol like a peer would —
  // this must never be routed to servePeer (direct tool access, no sidebar needed).
  const evil = connectPeer(b.port, "moz-extension://other");
  let gotResult = false;
  let settled = false;
  evil.on("open", () => { settled = true; });
  evil.on("error", () => { settled = true; }); // the handshake may fail outright — that's fine, it's still not a peer
  evil.on("message", (d) => { const m = JSON.parse(String(d)); if (m.type === "result") gotResult = true; });
  await until(() => settled);
  if (evil.readyState === WebSocket.OPEN) {
    evil.send(JSON.stringify({ type: "call", id: 1, tool: "appsheet_build", args: {}, timeoutMs: 1000 }));
  }
  await sleep(150);
  assert.equal(gotResult, false); // never answered as a peer — servePeer was never reached
  evil.close(); b.close();
});

test("close() during binding leaves nothing listening", async () => {
  const b = startBridge({ port: 0, link: new SidebarLink() });
  b.close();
  await sleep(300);
  assert.notEqual(b.mode, "hub");
  assert.equal(b.listening, false);
});

test("a port held by something that isn't a hub gives a clear error instead of hanging in 'starting'", async () => {
  const blocker = createServer((req, res) => { res.writeHead(403); res.end(); });
  await new Promise((resolve) => blocker.listen(0, "127.0.0.1", resolve));
  const port = blocker.address().port;
  const b = startBridge({ port, link: new SidebarLink(), retryMs: 50 });
  await sleep(250); // let the peer handshake attempt hit the blocker's 403 at least once
  await assert.rejects(b.call("appsheet_get_app", {}, 1000), (err) => {
    assert.match(err.message, /held by another program/);
    assert.match(err.message, new RegExp(String(port)));
    return true;
  });
  b.close();
  await new Promise((resolve) => blocker.close(resolve));
});

test("after taking over as hub, a peer accepts a sidebar and serves its calls", async () => {
  const first = startBridge({ port: 0, link: new SidebarLink() });
  await until(() => first.listening);
  const secondLink = new SidebarLink();
  const second = startBridge({ port: first.port, link: secondLink, retryMs: 50 });
  await until(() => second.mode === "peer");
  first.close();
  await until(() => second.mode === "hub", 3000);

  const sidebar = connect(second.port, "moz-extension://abcd");
  sidebar.on("message", (d) => { const m = JSON.parse(String(d)); sidebar.send(JSON.stringify({ type: "result", id: m.id, ok: true, result: { tool: m.tool } })); });
  await until(() => secondLink.connected);
  assert.deepEqual(await second.call("appsheet_get_app", {}, 1000), { tool: "appsheet_get_app" });
  sidebar.close(); second.close();
});

test("an in-flight peer call is rejected when the hub closes", async () => {
  const hub = startBridge({ port: 0, link: new SidebarLink() });
  await until(() => hub.listening);
  // A sidebar that never answers, so the hub's link.call(...) — and therefore
  // the peer's call — is still pending when we pull the hub out from under it.
  const sidebar = connect(hub.port, "moz-extension://abcd");
  const second = startBridge({ port: hub.port, link: new SidebarLink(), retryMs: 50 });
  await until(() => second.mode === "peer");
  const callPromise = second.call("appsheet_get_app", {}, 5000);
  await sleep(80); // let the call frame actually go out before the hub disappears
  hub.close();
  await assert.rejects(callPromise, { message: MOVED });
  sidebar.close(); second.close();
});
