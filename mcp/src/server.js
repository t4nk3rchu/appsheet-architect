#!/usr/bin/env node
// mcp/src/server.js — MCP stdio server "appsheet-copilot". Each tool forwards to
// the AppSheet Copilot sidebar through the WebSocket bridge. Never write to stdout
// (it carries the MCP protocol) — log to stderr.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SidebarLink, PORT, ANOTHER_SESSION } from "./link.js";
import { startBridge } from "./bridge.js";

const link = new SidebarLink();
// APPSHEET_COPILOT_PORT: test/dev override only — the add-on always uses 47813.
const bridge = startBridge({ port: Number(process.env.APPSHEET_COPILOT_PORT) || PORT, link });

const text = (value) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const fail = (message) => ({ ...text(message), isError: true });
const forward = (tool, timeoutMs) => async (args = {}) => {
  if (!bridge.listening) return fail(ANOTHER_SESSION);
  try { return text(await link.call(tool, args, timeoutMs)); }
  catch (e) { return fail(e.message); }
};
const SECONDS = 1000, MINUTES = 60 * SECONDS;

const server = new McpServer({ name: "appsheet-copilot", version: "1.0.0" });

server.registerTool("appsheet_get_app", {
  description: "Read the AppSheet app open in the user's Firefox (AppSheet Copilot sidebar): appId, appName, tables with columns/types/Enum values, and the names of existing views, slices, actions, format rules and bots. Call this first; pass its appId to the other tools.",
}, () => forward("appsheet_get_app", 30 * SECONDS)());

server.registerTool("appsheet_stage_changeset", {
  description: "Put a changeset into the AppSheet Copilot Build tab for the user to review. REPLACES whatever is in the Build box. Format: the appsheet skill's references/extension-changeset.md. Returns the plain-language plan and any validation issues — fix issues and stage again. Does not change the app.",
  inputSchema: {
    appId: z.string().describe("appId from appsheet_get_app"),
    changes: z.array(z.record(z.string(), z.unknown())).describe("The changeset's `changes` array"),
  },
}, forward("appsheet_stage_changeset", 30 * SECONDS));

server.registerTool("appsheet_build", {
  description: "Run Build now in the AppSheet Copilot sidebar: applies the changeset currently in the Build box to the open app's editor (a backup is taken first). Nothing is saved — the user must click Save in AppSheet. Only call when the user asked you to build. Refuses if the box is empty, invalid or has errors, or if a different app is open.",
  inputSchema: { appId: z.string().describe("appId from appsheet_get_app") },
}, forward("appsheet_build", 10 * MINUTES));

server.registerTool("appsheet_get_build_result", {
  description: "Get the result of the last Build now (by the user or by you): each change ok / warn / error with details, or status 'none'.",
}, () => forward("appsheet_get_build_result", 30 * SECONDS)());

await server.connect(new StdioServerTransport());
process.stderr.write("appsheet-copilot MCP helper started\n");
