import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BUSY = "请先关掉占用 5173/3001 的进程";
const SETUP_URL = "http://127.0.0.1:5173/setup/prizes";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  const cmd = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
}

async function waitForHealth(url, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

const serverFree = await isPortFree(3001);
const clientFree = await isPortFree(5173);
if (!serverFree || !clientFree) {
  console.error(BUSY);
  process.exit(1);
}

const env = { ...process.env, LOTTERY_PRIZE_SETUP: "1" };
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const childOpts = { env, stdio: "inherit", shell: true };
const server = spawn(npmCmd, ["run", "dev"], { ...childOpts, cwd: path.join(root, "server") });
const client = spawn(npmCmd, ["run", "dev"], { ...childOpts, cwd: path.join(root, "client") });
await waitForHealth("http://127.0.0.1:3001/api/health");
openBrowser(SETUP_URL);

function shutdown() {
  server.kill();
  client.kill();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
