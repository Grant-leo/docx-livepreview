/**
 * docxEditorProvider.ts — CustomTextEditorProvider for .docx files.
 *
 * Uses singleton PythonManager. Shows a low-res preview first (~50ms),
 * then upgrades to high-res. Pre-renders remaining pages in background.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getPythonManager } from "./pythonManager";
import { WpsRenderer } from "./wpsRenderer";
import { getHtmlForWebview } from "./webviewProvider";
import { getRenderDpi, getDefaultZoom, getAutoRefresh } from "./config";

class DocxDocument implements vscode.CustomDocument {
  private _uri: vscode.Uri;
  constructor(uri: vscode.Uri) { this._uri = uri; }
  get uri(): vscode.Uri { return this._uri; }
  dispose(): void {}
}

export class DocxEditorProvider implements vscode.CustomReadonlyEditorProvider<DocxDocument> {
  private renderer: WpsRenderer | null = null;
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentDocxPath: string = "";

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<DocxDocument> {
    // WPS lock files start with ~$ in the filename, not anywhere in path
    const basename = uri.fsPath.split(/[\\/]/).pop() || "";
    if (basename.startsWith("~$")) {
      throw new Error("Cannot preview WPS lock files");
    }
    return new DocxDocument(uri);
  }

  async resolveCustomEditor(
    document: DocxDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = getHtmlForWebview(
      webviewPanel.webview,
      this.context.extensionUri
    );

    this._activePanel = webviewPanel;
    const pythonManager = getPythonManager();

    // Ensure Python process is running (should already be warmed up)
    if (!pythonManager.isReady) {
      try {
        await pythonManager.start();
        await pythonManager.ensureWarmedUp();
      } catch (e: any) {
        webviewPanel.webview.postMessage({
          type: "error",
          message: `Failed to start Python renderer: ${e.message}`,
        });
        return;
      }
    }

    // Check cancellation before heavy work
    if (token.isCancellationRequested) { return; }

    // Close previous renderer if user opens another document
    if (this.renderer) {
      await this.renderer.close();
    }
    this.renderer = new WpsRenderer(pythonManager);
    this.currentDocxPath = document.uri.fsPath;

    // ── Open document ──
    let pageCount: number;
    try {
      pageCount = await this.renderer.open(document.uri.fsPath);
    } catch (e: any) {
      webviewPanel.webview.postMessage({
        type: "error",
        message: e.message || "Failed to open document",
      });
      return;
    }

    if (token.isCancellationRequested) { return; }

    const dpi = getRenderDpi();
    const zoom = getDefaultZoom();

    // ── Progressive: show low-res page 1 first (~50ms), then upgrade ──
    try {
      const lowRes = await this.renderer.renderPage(1, 72);
      webviewPanel.webview.postMessage({
        type: "setPage",
        image: lowRes,
        page: 1,
        totalPages: pageCount,
        zoom,
        dpi: 72,
      });
    } catch {
      // Fall through — will show high-res
    }

    // Request high-res page 1 immediately
    try {
      const highRes = await this.renderer.renderPage(1, dpi);
      webviewPanel.webview.postMessage({
        type: "setPage",
        image: highRes,
        page: 1,
        totalPages: pageCount,

        zoom,
        dpi,
      });
    } catch (e: any) {
      this.renderer.close().catch(() => {});
      webviewPanel.webview.postMessage({
        type: "error",
        message: e.message || "Failed to render page",
      });
      return;
    }

    // ── Background: pre-render remaining pages ──
    if (pageCount > 1) {
      this.renderer.renderAllPages(pageCount <= 10 ? dpi : 150).then((pages) => {
        const data = pages as { page: number; image: string }[];
        webviewPanel.webview.postMessage({
          type: "setAllPages",
          pages: data,
          totalPages: pageCount,
  
          zoom,
          dpi,
        });
      }).catch(() => {
        // Background pre-render failures are silent
      });
    }

    // ── Handle webview messages ──
    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      try {
        switch (msg.type) {
          case "requestPage": {
            if (!this.renderer) { return; }
            const img = await this.renderer.renderPage(msg.page);
            webviewPanel.webview.postMessage({
              type: "setPage",
              image: img,
              page: msg.page,
              totalPages: this.renderer.pageCount,
      
              zoom,
              dpi,
            });
            break;
          }
          case "refresh": {
            if (!this.renderer) { return; }
            const count = await this.renderer.open(document.uri.fsPath);
            const img = await this.renderer.renderPage(1);
            webviewPanel.webview.postMessage({
              type: "setPage",
              image: img,
              page: 1,
              totalPages: count,
      
              zoom,
              dpi,
            });
            break;
          }
          case "renderAll": {
            if (!this.renderer) { return; }
            const pages = await this.renderer.renderAllPages();
            webviewPanel.webview.postMessage({
              type: "setAllPages",
              pages,
              totalPages: pages.length,

              zoom,
              dpi,
            });
            break;
          }
          case "reverseSearch": {
            if (!this.renderer) { return; }
            const result = await this.renderer.reverseSearch(msg.page, msg.x, msg.y);
            if (result) {
              await this.openSourceLine(result.sourceLine);
            } else {
              vscode.window.showInformationMessage("No source mapping found at this position.");
            }
            break;
          }
        }
      } catch (e: any) {
        webviewPanel.webview.postMessage({
          type: "error",
          message: e.message || "Render failed",
        });
      }
    });

    // ── Auto-refresh on file change ──
    if (getAutoRefresh()) {
      this.setupAutoRefresh(document, webviewPanel);
    }

    // ── Cleanup on close ──
    webviewPanel.onDidDispose(() => {
      this.cleanupWatcher();
      if (this.renderer) {
        this.renderer.close().catch(() => { /* best-effort */ });
      }
    });
  }

  private async openSourceLine(sourceLine: number): Promise<void> {
    const buildScript = this.findBuildScript();
    if (!buildScript) {
      vscode.window.showErrorMessage(
        "No build script found. Set 'docx.sourceScript' to the path of your Python build script."
      );
      return;
    }
    const document = await vscode.workspace.openTextDocument(buildScript);
    const editor = await vscode.window.showTextDocument(document);
    const line = Math.max(0, sourceLine - 1); // VSCode lines are 0-based
    const range = document.lineAt(line).range;
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  }

  private findBuildScript(): string | null {
    // 1. User-configured path
    const config = vscode.workspace.getConfiguration("docx");
    const configured = config.get<string>("sourceScript", "");
    if (configured) {
      const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || "";
      const resolved = configured.replace("${workspaceFolder}", wsRoot);
      if (fs.existsSync(resolved)) { return resolved; }
    }
    // 2. Same directory as DOCX, common naming patterns
    const dir = path.dirname(this.currentDocxPath);
    const patterns = ["build_generated.py", "*_generated.py", "build_*.py"];
    for (const pattern of patterns) {
      try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (this._matchPattern(f, pattern)) {
            return path.join(dir, f);
          }
        }
      } catch { /* dir may not exist */ }
    }
    return null;
  }

  private _matchPattern(filename: string, pattern: string): boolean {
    const re = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/_/g, ".") + "$"
    );
    return re.test(filename);
  }

  /** Forward search: navigate preview to page containing sourceLine. */
  async goToSourceLine(sourceLine: number, webviewPanel?: vscode.WebviewPanel): Promise<void> {
    if (!this.renderer) { return; }
    const result = await this.renderer.forwardSearch(sourceLine);
    if (result) {
      const target = webviewPanel || this._activePanel;
      if (target) {
        target.webview.postMessage({ type: "navigateToPage", page: result.page });
        return;
      }
    }
    vscode.window.showInformationMessage(`No preview mapping found for line ${sourceLine}.`);
  }

  private _activePanel: vscode.WebviewPanel | null = null;

  private setupAutoRefresh(
    document: DocxDocument,
    panel: vscode.WebviewPanel
  ): void {
    this.cleanupWatcher();

    const watchPath = document.uri.fsPath;
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(watchPath);

    const onRefresh = () => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(async () => {
        try {
          if (!this.renderer) { return; }
          await this.renderer.open(watchPath);
          const img = await this.renderer.renderPage(1);
          const zoom = getDefaultZoom();
          const dpi = getRenderDpi();
          panel.webview.postMessage({
            type: "setPage",
            image: img,
            page: 1,
            totalPages: this.renderer.pageCount,
    
            zoom,
            dpi,
          });
        } catch {
          // Silently skip auto-refresh errors
        }
      }, 500);
    };

    this.fileWatcher.onDidChange(onRefresh);
    this.fileWatcher.onDidCreate(onRefresh);
    this.fileWatcher.onDidDelete(() => {
      panel.webview.postMessage({
        type: "error",
        message: "File has been deleted or moved.",
      });
    });
  }

  private cleanupWatcher(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.fileWatcher) {
      try { this.fileWatcher.dispose(); } catch { /* already disposed */ }
      this.fileWatcher = null;
    }
  }
}
