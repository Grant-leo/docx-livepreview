/**
 * docxEditorProvider.ts — Custom readonly editor provider for .docx files.
 *
 * Each preview panel owns an independent Python/WPS renderer so multiple DOCX
 * files can stay open side by side for visual comparison.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { PythonManager } from "./pythonManager";
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

interface PreviewSession {
  id: number;
  docxPath: string;
  panel: vscode.WebviewPanel;
  python: PythonManager;
  renderer: WpsRenderer;
  fileWatcher: vscode.FileSystemWatcher | null;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  lastPreviewPage: number;
  buildScriptIssue: string | null;
  disposables: vscode.Disposable[];
  disposed: boolean;
}

export class DocxEditorProvider implements vscode.CustomReadonlyEditorProvider<DocxDocument> {
  private sessions = new Map<vscode.WebviewPanel, PreviewSession>();
  private activePanel: vscode.WebviewPanel | null = null;
  private pendingSourceLine: number | null = null;
  private nextSessionId = 0;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<DocxDocument> {
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

    const session = this.createSession(document.uri.fsPath, webviewPanel);

    try {
      await this.ensurePythonReady(session);
    } catch (e: any) {
      if (this.isCurrentSession(session)) {
        webviewPanel.webview.postMessage({
          type: "error",
          message: `Failed to start Python renderer: ${e.message}`,
        });
      }
      return;
    }

    if (token.isCancellationRequested || !this.isCurrentSession(session)) {
      await this.disposeSession(session);
      return;
    }

    let pageCount: number;
    try {
      pageCount = await session.renderer.open(document.uri.fsPath);
    } catch (e: any) {
      if (this.isCurrentSession(session)) {
        webviewPanel.webview.postMessage({
          type: "error",
          message: e.message || "Failed to open document",
        });
      }
      return;
    }

    if (token.isCancellationRequested || !this.isCurrentSession(session)) {
      await this.disposeSession(session);
      return;
    }

    const dpi = getRenderDpi();
    const zoom = getDefaultZoom();

    try {
      const lowRes = await session.renderer.renderPage(1, 72);
      if (!this.isCurrentSession(session) || token.isCancellationRequested) {
        await this.disposeSession(session);
        return;
      }
      session.lastPreviewPage = 1;
      webviewPanel.webview.postMessage({
        type: "setPage",
        image: lowRes,
        page: 1,
        totalPages: pageCount,
        zoom,
        dpi: 72,
      });
    } catch {
      // Fall through and try the high-res render.
    }

    if (!this.isCurrentSession(session) || token.isCancellationRequested) {
      await this.disposeSession(session);
      return;
    }

    try {
      const highRes = await session.renderer.renderPage(1, dpi);
      if (!this.isCurrentSession(session) || token.isCancellationRequested) {
        await this.disposeSession(session);
        return;
      }
      session.lastPreviewPage = 1;
      webviewPanel.webview.postMessage({
        type: "setPage",
        image: highRes,
        page: 1,
        totalPages: pageCount,
        zoom,
        dpi,
      });
    } catch (e: any) {
      if (this.isCurrentSession(session)) {
        webviewPanel.webview.postMessage({
          type: "error",
          message: e.message || "Failed to render page",
        });
      }
      return;
    }

    if (!this.isCurrentSession(session) || token.isCancellationRequested) {
      await this.disposeSession(session);
      return;
    }

    await this.navigateToPendingSourceLine(session);

    if (getAutoRefresh() && this.isCurrentSession(session)) {
      this.setupAutoRefresh(session);
    }
  }

  async dispose(): Promise<void> {
    const sessions = Array.from(this.sessions.values());
    await Promise.all(sessions.map((session) => this.disposeSession(session)));
  }

  async refreshActivePreview(): Promise<void> {
    const session = this.getActiveSession();
    if (!session) {
      this.showTransientInfo("No preview panel is active.");
      return;
    }
    await this.refreshPreviewPanel(session, session.lastPreviewPage);
  }

  /** Open or reveal the active DOCX preview, then navigate it to the source line. */
  async goToPreviewFromEditor(editor: vscode.TextEditor): Promise<void> {
    const sourceLine = editor.selection.active.line + 1;
    const activeSession = this.getActiveSession();
    if (activeSession) {
      await this.goToSourceLine(sourceLine, activeSession, { reveal: true });
      return;
    }

    const docxUri = await this.findDocxForEditor(editor.document);
    if (!docxUri) {
      this.showTransientInfo("No DOCX file found for the active source editor.");
      return;
    }

    this.pendingSourceLine = sourceLine;
    await vscode.commands.executeCommand(
      "vscode.openWith",
      docxUri,
      "docx.docxPreview",
      { preview: false }
    );
  }

  /** Forward search: navigate a preview to the page containing sourceLine. */
  async goToSourceLine(
    sourceLine: number,
    session?: PreviewSession,
    options: PreviewNavigationOptions = {}
  ): Promise<boolean> {
    const targetSession = session || this.getActiveSession();
    if (!targetSession || !this.isCurrentSession(targetSession)) {
      if (!options.silent) {
        this.showTransientInfo("No preview renderer is active.");
      }
      return false;
    }

    const result = await targetSession.renderer.forwardSearch(sourceLine);
    if (!this.isCurrentSession(targetSession)) {
      return false;
    }
    if (result) {
      if (options.reveal !== false) {
        targetSession.panel.reveal(targetSession.panel.viewColumn, options.preserveFocus ?? false);
      }
      const posted = await targetSession.panel.webview.postMessage({
        type: "navigateToPage",
        page: result.page,
        x: result.x,
        y: result.y,
      });
      if (posted) {
        targetSession.lastPreviewPage = result.page;
        this.setActiveSession(targetSession);
        return true;
      }
    }

    if (!options.silent) {
      this.showTransientInfo(`No preview mapping found for line ${sourceLine}.`);
    }
    return false;
  }

  /** Reverse search: find source line for the active preview page center. */
  async goToSource(): Promise<void> {
    const session = this.getActiveSession();
    if (!session || !this.isCurrentSession(session)) {
      this.showTransientInfo("No preview panel is active.");
      return;
    }
    await this.postBookmarkPositions(session);
    const posted = await session.panel.webview.postMessage({ type: "requestReverseSearch" });
    if (!posted) {
      this.showTransientInfo("Preview panel is not ready.");
    }
  }

  private createSession(docxPath: string, panel: vscode.WebviewPanel): PreviewSession {
    const id = ++this.nextSessionId;
    const basename = path.basename(docxPath);
    const python = new PythonManager(this.context.extensionPath, `${id}:${basename}`);
    const session: PreviewSession = {
      id,
      docxPath,
      panel,
      python,
      renderer: new WpsRenderer(python),
      fileWatcher: null,
      debounceTimer: null,
      lastPreviewPage: 1,
      buildScriptIssue: null,
      disposables: [],
      disposed: false,
    };

    this.sessions.set(panel, session);
    this.setActiveSession(session);

    session.disposables.push(panel.webview.onDidReceiveMessage((msg) => {
      this.handleWebviewMessage(session, msg).catch((e: any) => {
        if (!this.isCurrentSession(session)) { return; }
        panel.webview.postMessage({
          type: "error",
          message: e.message || "Render failed",
        });
      });
    }));

    session.disposables.push(panel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active && this.isCurrentSession(session)) {
        this.setActiveSession(session);
      }
    }));

    session.disposables.push(panel.onDidDispose(() => {
      this.disposeSession(session).catch(() => { /* best-effort */ });
    }));

    return session;
  }

  private async handleWebviewMessage(session: PreviewSession, msg: any): Promise<void> {
    if (!this.isCurrentSession(session)) { return; }
    this.setActiveSession(session);

    switch (msg.type) {
      case "requestPage": {
        await this.ensurePythonReady(session);
        if (!this.isCurrentSession(session)) { return; }
        const img = await session.renderer.renderPage(msg.page);
        if (!this.isCurrentSession(session)) { return; }
        session.lastPreviewPage = msg.page;
        session.panel.webview.postMessage({
          type: "setPage",
          image: img,
          page: msg.page,
          totalPages: session.renderer.pageCount,
          requestId: msg.requestId,
          dpi: getRenderDpi(),
        });
        break;
      }
      case "refresh": {
        await this.refreshPreviewPanel(
          session,
          typeof msg.page === "number" ? msg.page : session.lastPreviewPage,
          msg.requestId
        );
        break;
      }
      case "reverseSearch": {
        const result = await session.renderer.reverseSearch(msg.page, msg.x, msg.y);
        if (!this.isCurrentSession(session)) { return; }
        if (result) {
          await this.openSourceLine(session, result.sourceLine);
        } else {
          this.showTransientInfo("No source mapping found at this position.");
        }
        break;
      }
      case "reverseSearchLine": {
        if (typeof msg.sourceLine === "number") {
          await this.openSourceLine(session, msg.sourceLine);
        }
        break;
      }
    }
  }

  private async ensurePythonReady(session: PreviewSession): Promise<void> {
    if (session.python.isReady) { return; }
    await session.python.start();
    await session.python.ensureWarmedUp();
  }

  private isCurrentSession(session: PreviewSession): boolean {
    return !session.disposed && this.sessions.get(session.panel) === session;
  }

  private setActiveSession(session: PreviewSession): void {
    if (this.isCurrentSession(session)) {
      this.activePanel = session.panel;
    }
  }

  private getActiveSession(): PreviewSession | undefined {
    const active = this.activePanel ? this.sessions.get(this.activePanel) : undefined;
    if (active && this.isCurrentSession(active)) {
      return active;
    }
    const sessions = Array.from(this.sessions.values()).filter((session) =>
      this.isCurrentSession(session)
    );
    return sessions[sessions.length - 1];
  }

  private async disposeSession(session: PreviewSession): Promise<void> {
    if (session.disposed) { return; }
    session.disposed = true;
    this.sessions.delete(session.panel);
    if (this.activePanel === session.panel) {
      this.activePanel = null;
    }
    this.cleanupWatcher(session);
    for (const disposable of session.disposables.splice(0)) {
      try { disposable.dispose(); } catch { /* already disposed */ }
    }
    await session.renderer.close().catch(() => { /* best-effort */ });
    await session.python.dispose().catch(() => { /* best-effort */ });
  }

  private async refreshPreviewPanel(
    session: PreviewSession,
    requestedPage: number,
    requestId?: number
  ): Promise<void> {
    if (!this.isCurrentSession(session)) { return; }
    await this.ensurePythonReady(session);
    if (!this.isCurrentSession(session)) { return; }

    const dpi = getRenderDpi();
    const pageCount = await session.renderer.open(session.docxPath);
    if (!this.isCurrentSession(session)) { return; }

    const page = Math.min(Math.max(1, requestedPage || 1), pageCount || 1);
    const img = await session.renderer.renderPage(page);
    if (!this.isCurrentSession(session)) { return; }

    session.lastPreviewPage = page;
    await session.panel.webview.postMessage({
      type: "setPage",
      image: img,
      page,
      totalPages: pageCount,
      dpi,
      resetCache: true,
      requestId,
    });
    await this.autoNavigateToActiveEditorLine(session);
  }

  private async postBookmarkPositions(session: PreviewSession): Promise<void> {
    if (!this.isCurrentSession(session)) { return; }
    try {
      const positions = await session.renderer.getAllBookmarkPositions();
      if (!this.isCurrentSession(session)) { return; }
      await session.panel.webview.postMessage({
        type: "bookmarkPositions",
        positions,
      });
    } catch {
      // Non-critical; preview rendering does not depend on source mapping.
    }
  }

  private async openSourceLine(session: PreviewSession, sourceLine: number): Promise<void> {
    const buildScript = this.findBuildScript(session);
    if (!buildScript) {
      this.showTransientInfo(
        session.buildScriptIssue ||
          "No build script found. Set 'docx.sourceScript' to the path of your Python build script."
      );
      return;
    }
    const document = await vscode.workspace.openTextDocument(buildScript);
    const editor = await vscode.window.showTextDocument(document);
    const line = Math.min(
      Math.max(0, sourceLine - 1),
      Math.max(0, document.lineCount - 1)
    );
    const range = document.lineAt(line).range;
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  }

  private findBuildScript(session: PreviewSession): string | null {
    session.buildScriptIssue = null;
    const config = vscode.workspace.getConfiguration("docx");
    const configured = config.get<string>("sourceScript", "");
    if (configured) {
      const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || "";
      const resolved = configured.replace("${workspaceFolder}", wsRoot);
      if (fs.existsSync(resolved)) { return resolved; }
      session.buildScriptIssue = "Configured source script was not found. Check 'docx.sourceScript'.";
      return null;
    }

    const dir = path.dirname(session.docxPath);
    const patterns = ["build_generated.py", "*_generated.py", "build_*.py"];
    const candidates = new Set<string>();
    for (const pattern of patterns) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (this.matchPattern(file, pattern)) {
            candidates.add(path.join(dir, file));
          }
        }
      } catch {
        // Directory may no longer exist.
      }
    }
    if (candidates.size === 1) {
      return Array.from(candidates)[0];
    }
    if (candidates.size > 1) {
      session.buildScriptIssue = "Multiple build scripts found. Set 'docx.sourceScript' to choose one.";
    }
    return null;
  }

  private matchPattern(filename: string, pattern: string): boolean {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("^" + escaped.replace(/\*/g, ".*") + "$");
    return re.test(filename);
  }

  private showTransientInfo(message: string): void {
    vscode.window.setStatusBarMessage(`DOCX: ${message}`, 3500);
  }

  private async navigateToPendingSourceLine(session: PreviewSession): Promise<void> {
    if (this.pendingSourceLine === null) { return; }
    const sourceLine = this.pendingSourceLine;
    this.pendingSourceLine = null;
    await this.goToSourceLine(sourceLine, session, { reveal: true });
  }

  private async findDocxForEditor(document: vscode.TextDocument): Promise<vscode.Uri | null> {
    const activeSession = this.getActiveSession();
    if (activeSession && fs.existsSync(activeSession.docxPath)) {
      return vscode.Uri.file(activeSession.docxPath);
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

  private async autoNavigateToActiveEditorLine(session: PreviewSession): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const doc = editor.document;
    if (!doc.fileName.endsWith(".py")) { return; }
    const line = editor.selection.active.line + 1;
    await this.goToSourceLine(line, session, { reveal: false, silent: true });
  }

  private setupAutoRefresh(session: PreviewSession): void {
    this.cleanupWatcher(session);

    const watchPath = session.docxPath;
    const watchDir = path.dirname(watchPath);
    const watchFile = path.basename(watchPath);
    const watchPattern = new vscode.RelativePattern(vscode.Uri.file(watchDir), "*");
    const isWatchedFile = (uri: vscode.Uri) =>
      path.basename(uri.fsPath).toLowerCase() === watchFile.toLowerCase() &&
      path.resolve(uri.fsPath).toLowerCase() === path.resolve(watchPath).toLowerCase();
    session.fileWatcher = vscode.workspace.createFileSystemWatcher(watchPattern);

    const onRefresh = () => {
      if (session.debounceTimer) {
        clearTimeout(session.debounceTimer);
      }
      session.debounceTimer = setTimeout(async () => {
        try {
          if (!this.isCurrentSession(session)) { return; }
          await this.refreshPreviewPanel(session, session.lastPreviewPage);
        } catch {
          this.showTransientInfo("Auto-refresh failed. The file may still be saving.");
        }
      }, 500);
    };

    session.fileWatcher.onDidChange((uri) => {
      if (isWatchedFile(uri)) { onRefresh(); }
    });
    session.fileWatcher.onDidCreate((uri) => {
      if (isWatchedFile(uri)) { onRefresh(); }
    });
    session.fileWatcher.onDidDelete((uri) => {
      if (!isWatchedFile(uri)) { return; }
      session.panel.webview.postMessage({
        type: "error",
        message: "File has been deleted or moved.",
      });
    });
  }

  private cleanupWatcher(session: PreviewSession): void {
    if (session.debounceTimer) {
      clearTimeout(session.debounceTimer);
      session.debounceTimer = null;
    }
    if (session.fileWatcher) {
      try { session.fileWatcher.dispose(); } catch { /* already disposed */ }
      session.fileWatcher = null;
    }
  }
}
