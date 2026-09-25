import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { SidebarLink, isAllowedOrigin, NO_SIDEBAR, BUSY } from "../src/link.js";

class FakeSocket extends EventEmitter {
  sent = []; closed = false;
  send(s) { this.sent.push(JSON.parse(s)); }
  close() { this.closed = true; this.emit("close"); }
  reply(msg) { this.emit("message", Buffer.from(JSON.stringify(msg))); }
}

test("origin rule: only Firefox add-on pages", () => {
  assert.equal(isAllowedOrigin("moz-extension://1234-abcd"), true);
  assert.equal(isAllowedOrigin("https://evil.example"), false);
  assert.equal(isAllowedOrigin(undefined), false);
});

test("no sidebar → clear error", async () => {
  await assert.rejects(new SidebarLink().call("appsheet_get_app", {}, 1000), { message: NO_SIDEBAR });
});

test("routes the result to the matching call", async () => {
  const link = new SidebarLink(); const s = new FakeSocket(); link.attach(s);
  const p = link.call("appsheet_get_app", {}, 1000);
  assert.deepEqual(s.sent[0], { type: "call", id: 1, tool: "appsheet_get_app", args: {} });
  s.reply({ type: "result", id: 1, ok: true, result: { appName: "X" } });
  assert.deepEqual(await p, { appName: "X" });
});

test("sidebar error becomes a rejection", async () => {
  const link = new SidebarLink(); const s = new FakeSocket(); link.attach(s);
  const p = link.call("appsheet_build", { appId: "a" }, 1000);
  s.reply({ type: "result", id: 1, ok: false, error: "The Build box is empty" });
  await assert.rejects(p, { message: "The Build box is empty" });
});

test("one request at a time", async () => {
  const link = new SidebarLink(); link.attach(new FakeSocket());
  link.call("appsheet_get_app", {}, 1000).catch(() => {});
  await assert.rejects(link.call("appsheet_get_app", {}, 1000), { message: BUSY });
});

test("times out with the wait in seconds", async () => {
  const link = new SidebarLink(); link.attach(new FakeSocket());
  await assert.rejects(link.call("appsheet_get_app", {}, 20), /didn't answer in time/);
});

test("a new sidebar replaces the old one and fails its pending call", async () => {
  const link = new SidebarLink(); const a = new FakeSocket(); link.attach(a);
  const p = link.call("appsheet_get_app", {}, 1000);
  const b = new FakeSocket(); link.attach(b);
  assert.equal(a.closed, true);
  await assert.rejects(p, /reconnected|disconnected/);
  assert.equal(link.connected, true);
});
