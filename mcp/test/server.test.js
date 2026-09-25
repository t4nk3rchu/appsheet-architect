import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, "..", "src", "server.js");

test("exits when the MCP client closes stdin, with empty stdout", async () => {
  const child = spawn(process.execPath, [SERVER_PATH], {
    env: { ...process.env, APPSHEET_COPILOT_PORT: "47931" },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  child.stdout.on("data", (d) => { stdout += d.toString(); });

  const exited = new Promise((resolve, reject) => {
    child.on("exit", (code) => resolve(code));
    child.on("error", reject);
  });

  child.stdin.end();

  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout waiting for exit")), 3000));
  const code = await Promise.race([exited, timeout]);

  assert.equal(code, 0);
  assert.equal(stdout, "");
});
