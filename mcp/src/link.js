// mcp/src/link.js — the one AppSheet Copilot sidebar connected to this helper.
// Tool calls are sent to it as {type:"call"} frames and wait for the matching
// {type:"result"}. Pure: the socket is injected (a `ws` WebSocket in production).
export const PORT = 47813;
export const NO_SIDEBAR = "Open the AppSheet Copilot sidebar in Firefox and set Provider → Coding agent (MCP).";
export const BUSY = "The sidebar is busy with another request.";
export const ANOTHER_SESSION = "Another coding-agent session has the AppSheet connection — use that session, or close it.";

// Browsers always send Origin on WebSocket upgrades and pages can't forge it,
// so this keeps web pages out. ponytail: any installed Firefox add-on passes —
// add a pairing token if that matters.
export const isAllowedOrigin = (origin) => typeof origin === "string" && origin.startsWith("moz-extension://");

export class SidebarLink {
  #socket = null;
  #nextId = 1;
  #pending = new Map(); // id → { resolve, reject, timer }

  attach(socket) {
    const old = this.#socket;
    this.#socket = socket;
    this.#failPending("The sidebar reconnected — try again.");
    if (old) old.close();
    socket.on("message", (data) => {
      let m;
      try { m = JSON.parse(String(data)); } catch { return; }
      if (m?.type !== "result") return;
      const p = this.#pending.get(m.id);
      if (!p) return;
      this.#pending.delete(m.id);
      clearTimeout(p.timer);
      if (m.ok) p.resolve(m.result);
      else p.reject(new Error(m.error || "The sidebar reported an error."));
    });
    socket.on("close", () => {
      if (this.#socket !== socket) return; // an old, replaced sidebar
      this.#socket = null;
      this.#failPending("The sidebar disconnected.");
    });
  }

  get connected() { return this.#socket !== null; }

  call(tool, args, timeoutMs) {
    if (!this.#socket) return Promise.reject(new Error(NO_SIDEBAR));
    if (this.#pending.size) return Promise.reject(new Error(BUSY));
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`The sidebar didn't answer in time (${Math.round(timeoutMs / 1000)} s).`));
      }, timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      this.#socket.send(JSON.stringify({ type: "call", id, tool, args }));
    });
  }

  #failPending(message) {
    for (const p of this.#pending.values()) { clearTimeout(p.timer); p.reject(new Error(message)); }
    this.#pending.clear();
  }
}
