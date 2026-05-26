/**
 * docxEditorProvider.ts — CustomTextEditorProvider for .docx files.
 *
 * Uses singleton PythonManager. Shows a low-res preview first (~50ms),
 * then upgrades to high-res. Additional pages render on demand.
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

interface PreviewNavigationOptions {
  reveal?: boolean;
  preserveFocus?: boolean;
  silent?: boolean;
}

export class DocxEditorProvider implements vscode.CustomReadonlyEditorProvider<DocxDocument> {
  private renderer: WpsRenderer | null = null;
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentDocxPath: string = "";
  private _activePanel: vscode.WebviewPanel | null = null;
  private _pendingSourceLine: number | null = null;
  private _lastPreviewPage = 1;
  private _activeSession = 0;
  private _resolveChain: Promise<void> = Promise.resolve();

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
    const task = this._resolveChain.then(
      () => this.resolveCustomEditorInner(document, webviewPanel, token),
      () => this.resolveCustomEditorInner(document, webviewPanel, token)
    );
    this._resolveChain = task.catch(() => { /* keep the resolve queue alive */ });
    return task;
  }

  private async resolveCustomEditorInner(
    document: DocxDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    const previousPanel = this._activePanel;
    await this.closeActiveRenderer();
    if (previousPanel && previousPanel !== webviewPanel) {
      previousPanel.dispose();
    }

    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = getHtmlForWebview(
      webviewPanel.webview,
      this.context.extensionUri
    );

    const sessionId = this.beginSession(webviewPanel);
    webviewPanel.onDidDispose(() => {
      if (this._activePanel !== webviewPanel) { return; }
      this.closeActiveRenderer().catch(() => { /* best-effort */ });
    });

    const pythonManager = getPythonManager();

    // Ensure Python process is running (should already be warmed up)
    if (!pythonManager.isReady) {
      try {
        await pythonManager.start();
        await pythonManager.ensureWarmedUp();
      } catch (e: any) {
        if (this.isCurrentSession(sessionId, webviewPanel)) {
          await this.closeSessionIfCurrent(sessionId, webviewPanel);
          webviewPanel.webview.postMessage({
            type: "error",
            message: `Failed to start Python renderer: ${e.message}`,
          });
        }
        return;
      }
    }

    if (token.isCancellationRequested || !this.isCurrentSession(sessionId, webviewPanel)) {
      await this.closeSessionIfCurrent(sessionId, webviewPanel);
      return;
    }

    const renderer = new WpsRenderer(pythonManager);
    this.renderer = renderer;
    this.currentDocxPath = document.uri.fsPath;
    this._lastPreviewPage = 1;

    // ── Open document ──
    let pageCount: number;
    try {
      pageCount = await renderer.open(document.uri.fsPath);
    } catch (e: any) {
      if (this.isCurrentSession(sessionId, webviewPanel, renderer)) {
        await this.closeActiveRenderer();
        webviewPanel.webview.postMessage({
          type: "error",
          message: e.message || "Failed to open document",
        });
      } else {
        await renderer.close().catch(() => { /* best-effort */ });
      }
      return;
    }

    if (token.isCancellationRequested || !this.isCurrentSession(sessionId, webviewPanel, renderer)) {
      await this.closeRendererForAbortedResolve(sessionId, webviewPanel, renderer);
      return;
    }

    const dpi = getRenderDpi();
    const zoom = getDefaultZoom();

    // ── Progressive: show low-res page 1 first (~50ms), then upgrade ──
    try {
      const lowRes = await renderer.renderPage(1, 72);
      if (!this.isCurrentSession(sessionId, webviewPanel, renderer) || token.isCancellationRequested) {
        await this.closeRendererForAbortedResolve(sessionId, webviewPanel, renderer);
        return;
      }
      this._lastPreviewPage = 1;
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
    if (!this.isCurrentSession(sessionId, webviewPanel, renderer) || token.isCancellationRequested) {
      await this.closeRendererForAbortedResolve(sessionId, webviewPanel, renderer);
      return;
    }

    // Request high-res page 1 immediately
    try {
      const highRes = await renderer.renderPage(1, dpi);
      if (!this.isCurrentSession(sessionId, webviewPanel, renderer) || token.isCancellationRequested) {
        await this.closeRendererForAbortedResolve(sessionId, webviewPanel, renderer);
        return;
      }
      this._lastPreviewPage = 1;
      webviewPanel.webview.postMessage({
        type: "setPage",
        image: highRes,
        page: 1,
        totalPages: pageCount,

        zoom,
        dpi,
      });
    } catch (e: any) {
      if (this.isCurrentSession(sessionId, webviewPanel, renderer)) {
        await this.closeActiveRenderer();
        webviewPanel.webview.postMessage({
          type: "error",
          message: e.message || "Failed to render page",
        });
      }
      return;
    }

    // ── Fetch bookmark positions for source mapping ──
    this.postBookmarkPositions(webviewPanel, sessionId, renderer).catch(() => {
      // Non-critical; preview rendering does not depend on source mapping.
    });

    // ── Handle webview messages ──
    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      try {
        switch (msg.type) {
          case "requestPage": {
            if (!this.isCurrentSession(sessionId, webviewPanel, renderer)) { return; }
            const img = await renderer.renderPage(msg.page);
            if (!this.isCurrentSession(sessionId, webviewPanel, renderer)) { return; }
            this._lastPreviewPage = msg.page;
            webviewPanel.webview.postMessage({
              type: "setPage",
              image: img,
              page: msg.page,
              totalPages: renderer.pageCount,
              requestId: msg.requestId,
      
              zoom,
              dpi,
            });
            break;
          }
          case "refresh": {
            await this.refreshPreviewPanel(
              document.uri.fsPath,
              webviewPanel,
              typeof msg.page === "number" ? msg.page : this._lastPreviewPage,
              sessionId,
              msg.requestId
            );
            break;
          }
          case "reverseSearch": {
            if (!this.isCurrentSession(sessionId, webviewPanel, renderer)) { return; }
            const result = await renderer.reverseSearch(msg.page, msg.x, msg.y);
            if (!this.isCurrentSession(sessionId, webviewPanel, renderer)) { return; }
            if (result) {
              await this.openSourceLine(result.sourceLine);
            } else {
              this.showTransientInfo("No source mapping found at this position.");
            }
            break;
          }
          case "reverseSearchLine": {
            if (!this.isCurrentSession(sessionId, webviewPanel, renderer)) { return; }
            if (typeof msg.sourceLine === "number") {
              await this.openSourceLine(msg.sourceLine);
            }
            break;
          }
        }
      } catch (e: any) {
        if (!this.isCurrentSession(sessionId, webviewPanel, renderer)) { return; }
        webviewPanel.webview.postMessage({
          type: "error",
          message: e.message || "Render failed",
        });
      }
    });

    // ── Auto-refresh on file change ──
    if (!this.isCurrentSession(sessionId, webviewPanel, renderer) || token.isCancellationRequested) {
      await this.closeRendererForAbortedResolve(sessionId, webviewPanel, renderer);
      return;
    }
    await this._navigateToPendingSourceLine(webviewPanel);

    if (getAutoRefresh() && this.isCurrentSession(sessionId, webviewPanel, renderer)) {
      this.setupAutoRefresh(document, webviewPanel, sessionId);
    }
  }

  private async closeActiveRenderer(): Promise<void> {
    const renderer = this.renderer;
    this._activeSession++;
    this.cleanupWatcher();
    this.renderer = null;
    this.currentDocxPath = "";
    this._activePanel = null;
    this._lastPreviewPage = 1;
    if (renderer) {
      await renderer.close().catch(() => { /* best-effort */ });
    }
  }

  private beginSession(webviewPanel: vscode.WebviewPanel): number {
    const sessionId = ++this._activeSession;
    this._activePanel = webviewPanel;
    return sessionId;
  }

  private isCurrentSession(
    sessionId: number,
    webviewPanel: vscode.WebviewPanel,
    renderer?: WpsRenderer
  ): boolean {
    return this._activeSession === sessionId &&
      this._activePanel === webviewPanel &&
      (!renderer || this.renderer === renderer);
  }

  private async closeSessionIfCurrent(
    sessionId: number,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    if (this.isCurrentSession(sessionId, webviewPanel)) {
      await this.closeActiveRenderer();
    }
  }

  private async closeRendererForAbortedResolve(
    sessionId: number,
    webviewPanel: vscode.WebviewPanel,
    renderer: WpsRenderer
  ): Promise<void> {
    if (this.isCurrentSession(sessionId, webviewPanel, renderer)) {
      await this.closeActiveRenderer();
    } else if (this.renderer !== renderer) {
      await renderer.close().catch(() => { /* best-effort */ });
    }
  }

  async refreshActivePreview(): Promise<void> {
    if (!this.renderer || !this._activePanel || !this.currentDocxPath) {
      this.showTransientInfo("No preview panel is active.");
      return;
    }
    await this.refreshPreviewPanel(
      this.currentDocxPath,
      this._activePanel,
      this._lastPreviewPage,
      this._activeSession
    );
  }

  private async refreshPreviewPanel(
    docxPath: string,
    webviewPanel: vscode.WebviewPanel,
    requestedPage: number,
    sessionId: number,
    requestId?: number
  ): Promise<void> {
    const renderer = this.renderer;
    if (!renderer ||
      !this.isCurrentSession(sessionId, webviewPanel, renderer) ||
      this.currentDocxPath !== docxPath) {
      return;
    }
    const dpi = getRenderDpi();
    const zoom = getDefaultZoom();
    const pageCount = await renderer.open(docxPath);
    if (!this.isCurrentSession(sessionId, webviewPanel, renderer) ||
      this.currentDocxPath !== docxPath) {
      return;
    }
    const page = Math.min(Math.max(1, requestedPage || 1), pageCount || 1);
    const img = await renderer.renderPage(page);
    if (!this.isCurrentSession(sessionId, webviewPanel, renderer) ||
      this.currentDocxPath !== docxPath) {
      return;
    }
    this._lastPreviewPage = page;
    await webviewPanel.webview.postMessage({
      type: "setPage",
      image: img,
      page,
      totalPages: pageCount,
      zoom,
      dpi,
      resetCache: true,
      requestId,
    });
    await this.postBookmarkPositions(webviewPanel, sessionId, renderer);
    await this._autoNavigateToActiveEditorLine(webviewPanel);
  }

  private async postBookmarkPositions(
    webviewPanel: vscode.WebviewPanel,
    sessionId: number,
    renderer: WpsRenderer
  ): Promise<void> {
    if (!this.isCurrentSession(sessionId, webviewPanel, renderer)) { return; }
    try {
      const positions = await renderer.getAllBookmarkPositions();
      if (!this.isCurrentSession(sessionId, webviewPanel, renderer)) { return; }
      await webviewPanel.webview.postMessage({
        type: "bookmarkPositions",
        positions,
      });
    } catch {
      // Non-critical; preview rendering does not depend on source mapping.
    }
  }

  private async openSourceLine(sourceLine: number): Promise<void> {
    const buildScript = this.findBuildScript();
    if (!buildScript) {
      this.showTransientInfo(
        "No build script found. Set 'docx.sourceScript' to the path of your Python build script."
      );
      return;
    }
    const document = await vscode.workspace.openTextDocument(buildScript);
    const editor = await vscode.window.showTextDocument(document);
    const line = Math.min(
      Math.max(0, sourceLine - 1),
      Math.max(0, document.lineCount - 1)
    ); // VSCode lines are 0-based
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
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      "^" + escaped.replace(/\*/g, ".*") + "$"
    );
    return re.test(filename);
  }

  /** Open or reveal the DOCX preview, then navigate it to the active source line. */
  async goToPreviewFromEditor(editor: vscode.TextEditor): Promise<void> {
    const sourceLine = editor.selection.active.line + 1; // 1-based
    const target = this._activePanel;
    if (this.renderer && target) {
      await this.goToSourceLine(sourceLine, target, { reveal: true });
      return;
    }

    const docxUri = await this.findDocxForEditor(editor.document);
    if (!docxUri) {
      this.showTransientInfo("No DOCX file found for the active source editor.");
      return;
    }

    this._pendingSourceLine = sourceLine;
    await vscode.commands.executeCommand(
      "vscode.openWith",
      docxUri,
      "docx.docxPreview",
      { preview: false }
    );
  }

  /** Forward search: navigate preview to page containing sourceLine. */
  async goToSourceLine(
    sourceLine: number,
    webviewPanel?: vscode.WebviewPanel,
    options: PreviewNavigationOptions = {}
  ): Promise<boolean> {
    const renderer = this.renderer;
    const target = webviewPanel || this._activePanel;
    const sessionId = this._activeSession;
    if (!renderer || !target || !this.isCurrentSession(sessionId, target, renderer)) {
      if (!options.silent) {
        this.showTransientInfo("No preview renderer is active.");
      }
      return false;
    }

    const result = await renderer.forwardSearch(sourceLine);
    if (!this.isCurrentSession(sessionId, target, renderer)) {
      return false;
    }
    if (result) {
      if (options.reveal !== false) {
        target.reveal(target.viewColumn, options.preserveFocus ?? false);
      }
      const posted = await target.webview.postMessage({
        type: "navigateToPage",
        page: result.page,
        x: result.x,
        y: result.y,
      });
      if (posted) {
        this._lastPreviewPage = result.page;
        return true;
      }
    }

    if (!options.silent) {
      this.showTransientInfo(`No preview mapping found for line ${sourceLine}.`);
    }
    return false;
  }

  /** Reverse search: find source line for current preview page center. */
  async goToSource(): Promise<void> {
    if (this._activePanel) {
      const posted = await this._activePanel.webview.postMessage({ type: "requestReverseSearch" });
      if (!posted) {
        this.showTransientInfo("Preview panel is not ready.");
      }
    } else {
      this.showTransientInfo("No preview panel is active.");
    }
  }

  private showTransientInfo(message: string): void {
    vscode.window.setStatusBarMessage(`DOCX: ${message}`, 3500);
  }

  private async _navigateToPendingSourceLine(webviewPanel: vscode.WebviewPanel): Promise<void> {
    if (this._pendingSourceLine === null) { return; }
    const sourceLine = this._pendingSourceLine;
    this._pendingSourceLine = null;
    await this.goToSourceLine(sourceLine, webviewPanel, { reveal: true });
  }

  private async findDocxForEditor(document: vscode.TextDocument): Promise<vscode.Uri | null> {
    if (this.currentDocxPath && fs.existsSync(this.currentDocxPath)) {
      return vscode.Uri.file(this.currentDocxPath);
    }

    const sourcePath = document.uri.scheme === "file" ? document.uri.fsPath : "";
    if (sourcePath) {
      const sameDirMatch = this.pickMostRecentDocx(this.findDocxFilesInDir(path.dirname(sourcePath)));
      if (sameDirMatch) { return sameDirMatch; }
    }

    const workspaceMatches = await vscode.workspace.findFiles("**/*.docx", "**/~$*.docx", 20);
    return this.pickMostRecentDocx(workspaceMatches);
  }

  private findDocxFilesInDir(dir: string): vscode.Uri[] {
    try {
      return fs.readdirSync(dir)
        .filter((file) => this.isPreviewableDocx(file))
        .map((file) => vscode.Uri.file(path.join(dir, file)));
    } catch {
      return [];
    }
  }

  private pickMostRecentDocx(uris: vscode.Uri[]): vscode.Uri | null {
    const candidates = uris
      .filter((uri) => this.isPreviewableDocx(path.basename(uri.fsPath)))
      .map((uri) => {
        try {
          return { uri, mtimeMs: fs.statSync(uri.fsPath).mtimeMs };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { uri: vscode.Uri; mtimeMs: number } => entry !== null)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return candidates[0]?.uri || null;
  }

  private isPreviewableDocx(filename: string): boolean {
    return filename.toLowerCase().endsWith(".docx") && !filename.startsWith("~$");
  }

  /** After refresh, auto-navigate preview to the active editor's cursor line. */
  private async _autoNavigateToActiveEditorLine(webviewPanel: vscode.WebviewPanel): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const doc = editor.document;
    if (!doc.fileName.endsWith(".py")) { return; }
    const line = editor.selection.active.line + 1; // 1-based
    await this.goToSourceLine(line, webviewPanel, { reveal: false, silent: true });
  }

  private setupAutoRefresh(
    document: DocxDocument,
    panel: vscode.WebviewPanel,
    sessionId: number
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
          if (!this.renderer || !this.isCurrentSession(sessionId, panel, this.renderer)) { return; }
          await this.refreshPreviewPanel(watchPath, panel, this._lastPreviewPage, sessionId);
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
