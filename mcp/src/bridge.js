// mcp/src/bridge.js — WebSocket server the AppSheet Copilot sidebar connects to.
// 127.0.0.1 only, Firefox add-on origins only.
//
// Only one helper process can bind the port — the "hub". Every other helper
// process (the Claude desktop app starts one per session) becomes a "peer":
// it connects to the hub as a WebSocket client and forwards its tool calls
// through it, so every session can use the tools, not just the first.
import { WebSocketServer, WebSocket } from "ws";
import { isAllowedOrigin } from "./link.js";

// A peer identifies itself with this subprotocol and (unlike a browser tab,
// which always sends Origin and can't suppress it) no Origin header. A web
// page can request this subprotocol too, but it can never omit Origin, so it
// still can't pass verifyClient below.
const PEER_PROTOCOL = "appsheet-copilot-peer";
export const STARTING = "Starting up — try again in a moment.";
export const MOVED = "The AppSheet connection moved — try again.";

const isPeerHandshake = (info) => {
  if (info.origin) return false; // browsers always send Origin; peers never do
  const offered = String(info.req.headers["sec-websocket-protocol"] || "").split(",").map((s) => s.trim());
  return offered.includes(PEER_PROTOCOL);
};

export function startBridge({ port, host = "127.0.0.1", link, retryMs = 5000 }) {
  let mode = "starting"; // "starting" | "hub" | "peer"
  let wss = null;
  let peerSocket = null;
  let stopped = false;
  let timer = null;
  let nextId = 1;
  const pending = new Map(); // id → { resolve, reject, timer }

  const failPending = (message) => {
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error(message)); }
    pending.clear();
  };

  // A peer's frame is {type:"call", id, tool, args, timeoutMs}; run it against
  // our own sidebar link and send back the result (or the hub-side error)
  // verbatim, so NO_SIDEBAR / BUSY / timeouts reach the peer unchanged.
  const servePeer = (socket) => {
    socket.on("message", async (data) => {
      let m;
      try { m = JSON.parse(String(data)); } catch { return; }
      if (m?.type !== "call") return;
      try {
        const result = await link.call(m.tool, m.args, m.timeoutMs);
        socket.send(JSON.stringify({ type: "result", id: m.id, ok: true, result }));
      } catch (e) {
        socket.send(JSON.stringify({ type: "result", id: m.id, ok: false, error: e.message }));
      }
    });
  };

  const listenAsHub = () => {
    if (stopped) return;
    const server = new WebSocketServer({
      host, port,
      verifyClient: (info, done) => done(isAllowedOrigin(info.origin) || isPeerHandshake(info), 403),
      handleProtocols: (protocols) => (protocols.has(PEER_PROTOCOL) ? PEER_PROTOCOL : false),
    });
    server.on("listening", () => { wss = server; mode = "hub"; });
    server.on("connection", (socket) => {
      if (socket.protocol === PEER_PROTOCOL) servePeer(socket);
      else link.attach(socket);
    });
    server.on("error", (err) => {
      wss = null;
      server.close();
      if (stopped) return;
      if (err.code === "EADDRINUSE") connectAsPeer();
      else { process.stderr.write(`appsheet-copilot bridge error: ${err.message}\n`); mode = "starting"; timer = setTimeout(listenAsHub, retryMs); }
    });
  };

  const connectAsPeer = () => {
    if (stopped) return;
    mode = "starting";
    const socket = new WebSocket(`ws://${host}:${port}`, PEER_PROTOCOL);
    peerSocket = socket;
    socket.on("open", () => { mode = "peer"; });
    socket.on("message", (data) => {
      let m;
      try { m = JSON.parse(String(data)); } catch { return; }
      if (m?.type !== "result") return;
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      clearTimeout(p.timer);
      if (m.ok) p.resolve(m.result); else p.reject(new Error(m.error || "The sidebar reported an error."));
    });
    const onDown = () => {
      if (peerSocket !== socket) return; // already replaced
      peerSocket = null;
      failPending(MOVED);
      if (stopped) return;
      mode = "starting";
      timer = setTimeout(listenAsHub, retryMs); // try to become hub; falls back to peer again on EADDRINUSE
    };
    socket.on("close", onDown);
    socket.on("error", onDown);
  };

  listenAsHub();

  return {
    get mode() { return mode; },
    get listening() { return mode === "hub"; },
    get port() { return mode === "hub" ? wss?.address()?.port : port; },
    call(tool, args, timeoutMs) {
      if (mode === "hub") return link.call(tool, args, timeoutMs);
      if (mode === "peer") {
        const socket = peerSocket;
        const id = nextId++;
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`The sidebar didn't answer in time (${Math.round(timeoutMs / 1000)} s).`));
          }, timeoutMs + 2000);
          pending.set(id, { resolve, reject, timer });
          socket.send(JSON.stringify({ type: "call", id, tool, args, timeoutMs }));
        });
      }
      return Promise.reject(new Error(STARTING));
    },
    close() {
      stopped = true;
      clearTimeout(timer);
      failPending(MOVED);
      if (peerSocket) { peerSocket.close(); peerSocket = null; }
      if (wss) { for (const c of wss.clients) c.terminate(); wss.close(); wss = null; }
      mode = "starting";
    },
  };
}
