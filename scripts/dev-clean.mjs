/**
 * Ensures a single Next.js dev server on port 3000 with a fresh build cache.
 * Fixes the common "unstyled UI" issue caused by multiple dev servers sharing
 * a corrupted .next folder (CSS/JS chunks return 404).
 */
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const PORT = process.env.PORT || "3000";

function killPort(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split("\n")) {
        const m = line.match(/LISTENING\s+(\d+)/i);
        if (m) pids.add(m[1]);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
          console.log(`Stopped process ${pid} on port ${port}`);
        } catch {
          /* already gone */
        }
      }
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { stdio: "ignore", shell: true });
    }
  } catch {
    /* port free */
  }
}

// Stop stray servers that steal or conflict with the primary port.
killPort(PORT);
killPort("3001");

const nextDir = path.join(root, ".next");

function clearNextDir() {
  if (!fs.existsSync(nextDir)) return;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      fs.rmSync(nextDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      console.log("Cleared .next build cache");
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      console.log(`Retry clearing .next (${attempt}/3)…`);
      try {
        execSync("ping -n 2 127.0.0.1 > nul", { stdio: "ignore", shell: true });
      } catch {
        /* ignore */
      }
    }
  }
}

clearNextDir();

console.log(`\nStarting Entertain Passport dev server → http://localhost:${PORT}\n`);

const child = spawn("npx", ["next", "dev", "-p", PORT], {
  stdio: "inherit",
  shell: true,
  cwd: root,
});

child.on("exit", (code) => process.exit(code ?? 0));
