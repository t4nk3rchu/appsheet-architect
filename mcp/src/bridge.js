// mcp/src/bridge.js — WebSocket server the AppSheet Copilot sidebar connects to.
// 127.0.0.1 only, Firefox add-on origins only. If the port is taken (another
// agent session's helper), keep retrying so this one takes over when it exits.
import { WebSocketServer } from "ws";
import { isAllowedOrigin } from "./link.js";

export function startBridge({ port, host = "127.0.0.1", link, retryMs = 5000 }) {
  let wss = null, listening = false, stopped = false, timer = null;
  const listen = () => {
    if (stopped) return;
    const server = new WebSocketServer({
      host, port,
      verifyClient: (info, done) => done(isAllowedOrigin(info.origin), 403),
    });
    server.on("listening", () => { wss = server; listening = true; });
    server.on("connection", (socket) => link.attach(socket));
    server.on("error", (err) => {
      listening = false;
      server.close();
      if (err.code === "EADDRINUSE" && !stopped) timer = setTimeout(listen, retryMs);
      else process.stderr.write(`appsheet-copilot bridge error: ${err.message}\n`);
    });
  };
  listen();
  return {
    get listening() { return listening; },
    get port() { return wss?.address()?.port; },
    close() { stopped = true; clearTimeout(timer); listening = false; wss?.close(); for (const c of wss?.clients ?? []) c.terminate(); },
  };
}
