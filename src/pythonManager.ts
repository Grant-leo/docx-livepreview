/**
 * pythonManager.ts — Manages the Python render_server.py child process.
 *
 * Singleton: one Python + WPS process shared across all documents.
 * Pre-warmed on extension activation so first open is instant.
 */
import * as vscode from "vscode";
import { ChildProcess, spawn } from "child_process";
import { getPythonPath } from "./config";

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class PythonManager {
  private process: ChildProcess | null = null;
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private buffer = "";
  private restartCount = 0;
  private maxRestarts = 3;
  private scriptPath: string;
  private outputChannel: vscode.OutputChannel;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private warmedUp = false;
  private _ready = false;
  private _startPromise: Promise<void> | null = null;

  constructor(extensionPath: string) {
    this.scriptPath = extensionPath + "/python/render_server.py";
    this.outputChannel = vscode.window.createOutputChannel("DOCX Renderer");
  }

  /** Whether the process is running and has responded to ping. */
  get isReady(): boolean {
    return this._ready && this.process !== null && !this.process.killed;
  }

  /** Start the Python child process. Resolves when ping succeeds. Safe to call concurrently. */
  async start(): Promise<void> {
    if (this.disposed) { return; }

    // If already starting, wait for the existing start to complete
    if (this._startPromise) {
      return this._startPromise;
    }

    // If already ready, nothing to do
    if (this.isReady) { return; }

    this._startPromise = this._doStart();
    try {
      await this._startPromise;
    } finally {
      this._startPromise = null;
    }
  }

  private async _doStart(): Promise<void> {
    if (this.process) { await this._doStop(); }

    const pythonPath = getPythonPath();
    this.outputChannel.appendLine(`[PythonManager] Starting: ${pythonPath} -u ${this.scriptPath}`);

    this.process = spawn(pythonPath, ["-u", this.scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
    });

    this.process.on("error", (err) => {
      this.outputChannel.appendLine(`[PythonManager] Process error: ${err.message}`);
      this._ready = false;
    });

    this.process.on("exit", (code, signal) => {
      this.outputChannel.appendLine(
        `[PythonManager] Process exited code=${code} signal=${signal}`
      );
      this._ready = false;
      this.warmedUp = false;
      if (!this.disposed && code !== 0 && signal !== "SIGTERM") {
        this.attemptRestart();
      }
    });

    if (this.process.stderr) {
      this.process.stderr.on("data", (data: Buffer) => {
        this.outputChannel.appendLine(`[Python stderr] ${data.toString().trim()}`);
      });
    }

    if (this.process.stdout) {
      this.process.stdout.on("data", (data: Buffer) => {
        this.buffer += data.toString();
        this.processBuffer();
      });
    }

    // Allow send() through — process is spawned and listening
    this._ready = true;

    // Wait for process to respond
    try {
      await this.send("ping", {});
    } catch (e) {
      this._ready = false;
      throw e;
    }
    this.restartCount = 0;

    // Start health check
    this.healthTimer = setInterval(() => this.healthCheck(), 30000);
  }

  /** Pre-warm the WPS COM server so first open_document is fast. */
  async ensureWarmedUp(): Promise<void> {
    if (this.warmedUp) { return; }
    if (!this.isReady) { return; }
    try {
      const logStart = Date.now();
      this.outputChannel.appendLine("[PythonManager] Pre-warming WPS COM...");
      await this.send("warm_up", {}, 15000);
      this.warmedUp = true;
      this.outputChannel.appendLine(
        `[PythonManager] WPS COM ready (${Date.now() - logStart}ms)`
      );
    } catch (e: any) {
      this.outputChannel.appendLine(
        `[PythonManager] Warm-up failed: ${e.message}`
      );
    }
  }

  /** Send a request to the Python process and return the response. */
  send(method: string, params: Record<string, any> = {}, timeoutMs = 60000): Promise<any> {
    if (!this._ready || !this.process || this.process.killed) {
      return Promise.reject(new Error("Python process is not running"));
    }

    const id = this.nextId++;
    const request = JSON.stringify({ id, method, params }) + "\n";

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      try {
        this.process!.stdin!.write(request);
      } catch (e: any) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new Error(`Failed to write to Python stdin: ${e.message}`));
      }
    });
  }

  /** Stop the Python process gracefully. */
  async stop(): Promise<void> {
    // Wait for any in-progress start before stopping
    if (this._startPromise) {
      try { await this._startPromise; } catch { /* ignore */ }
    }
    await this._doStop();
  }

  private async _doStop(): Promise<void> {
    this.warmedUp = false;
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }

    if (!this.process || this.process.killed) {
      this.process = null;
      this._ready = false;
      return;
    }

    try {
      await this.send("shutdown", {}, 5000);
    } catch {
      // Force kill if graceful shutdown fails
    }

    this._ready = false;

    return new Promise((resolve) => {
      if (!this.process || this.process.killed) {
        resolve();
        return;
      }
      const killer = setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill("SIGKILL");
        }
        this.process = null;
        resolve();
      }, 3000);

      this.process!.once("exit", () => {
        clearTimeout(killer);
        this.process = null;
        resolve();
      });

      try {
        this.process!.stdin!.end();
      } catch {
        // stdin already closed
      }
    });
  }

  /** Dispose all resources. */
  dispose(): void {
    this.disposed = true;
    this.stop();
    this.outputChannel.dispose();
  }

  // ── private ──

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) { continue; }
      try {
        const msg = JSON.parse(line);
        const id = msg.id;
        const pending = this.pending.get(id);
        if (!pending) { continue; }

        clearTimeout(pending.timer);
        this.pending.delete(id);

        if (msg.error) {
          pending.reject(new Error(msg.error.message));
        } else {
          pending.resolve(msg.result);
        }
      } catch {
        this.outputChannel.appendLine(`[PythonManager] Unparseable output: ${line}`);
      }
    }
  }

  private async healthCheck(): Promise<void> {
    try {
      await this.send("ping", {}, 5000);
    } catch {
      this.outputChannel.appendLine("[PythonManager] Health check failed, restarting...");
      this._ready = false;
      this.warmedUp = false;
      this.attemptRestart();
    }
  }

  private async attemptRestart(): Promise<void> {
    if (this.disposed) { return; }
    this.restartCount++;
    if (this.restartCount > this.maxRestarts) {
      vscode.window.showErrorMessage(
        "DOCX: Python renderer crashed too many times. Check Output panel for details."
      );
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.restartCount - 1), 8000);
    this.outputChannel.appendLine(
      `[PythonManager] Restart attempt ${this.restartCount}/${this.maxRestarts} in ${delay}ms`
    );
    await new Promise((r) => setTimeout(r, delay));
    try {
      await this.start();
      await this.ensureWarmedUp();
      this.outputChannel.appendLine("[PythonManager] Restart succeeded");
    } catch (e) {
      this.outputChannel.appendLine(`[PythonManager] Restart failed: ${e}`);
    }
  }
}

let instance: PythonManager | null = null;

/** Get or create the singleton PythonManager. */
export function getPythonManager(extensionPath?: string): PythonManager {
  if (!instance) {
    if (!extensionPath) {
      throw new Error("PythonManager not initialized. Call getPythonManager(path) first.");
    }
    instance = new PythonManager(extensionPath);
  }
  return instance;
}
