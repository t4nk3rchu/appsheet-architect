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
// Same rule, from a raw request (handleProtocols/connection get `req`, not `info`).
const isPeerReq = (req) => isPeerHandshake({ origin: req.headers.origin, req });

export function startBridge({ port, host = "127.0.0.1", link, retryMs = 5000 }) {
  let mode = "starting"; // "starting" | "hub" | "peer"
  let wss = null;
  let boundServer = null; // the WebSocketServer currently binding or bound, even before "listening" fires
  let peerSocket = null;
  let stopped = false;
  let timer = null;
  let blockedReason = null; // set when the port is held by something that isn't answering as a hub
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
      handleProtocols: (protocols, req) => (isPeerReq(req) ? PEER_PROTOCOL : false),
    });
    boundServer = server;
    server.on("listening", () => {
      if (stopped) { server.close(); return; } // close() ran while we were still binding
      wss = server; mode = "hub"; blockedReason = null;
    });
    server.on("connection", (socket, req) => {
      if (isPeerReq(req)) servePeer(socket);
      else link.attach(socket);
    });
    server.on("error", (err) => {
      wss = null;
      boundServer = null;
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
    socket.on("open", () => { mode = "peer"; blockedReason = null; });
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
    // The thing on the port answered with plain HTTP, not a WS upgrade — an
    // older helper version 403ing us, or an unrelated program. Not a hub we
    // can ever join, so give a clear error instead of sitting in "starting".
    socket.on("unexpected-response", (req, res) => {
      res.resume();
      req.destroy();
      if (peerSocket !== socket) return;
      peerSocket = null;
      blockedReason = `Port ${port} is held by another program or an older AppSheet helper — restart your coding-agent sessions (or free the port) and try again.`;
      if (stopped) return;
      mode = "starting";
      timer = setTimeout(listenAsHub, retryMs);
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
      return Promise.reject(new Error(blockedReason || STARTING));
    },
    close() {
      stopped = true;
      clearTimeout(timer);
      failPending(MOVED);
      if (peerSocket) { peerSocket.terminate(); peerSocket = null; }
      if (boundServer) { for (const c of boundServer.clients) c.terminate(); boundServer.close(); boundServer = null; }
      wss = null;
      mode = "starting";
    },
  };
}
