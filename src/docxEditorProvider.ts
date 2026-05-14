/**
 * docxEditorProvider.ts — CustomTextEditorProvider for .docx files.
 *
 * Uses singleton PythonManager. Shows a low-res preview first (~50ms),
 * then upgrades to high-res. Pre-renders remaining pages in background.
 */
import * as vscode from "vscode";
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

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<DocxDocument> {
    if (uri.fsPath.includes("~$")) {
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
        this.renderer.close();
      }
    });
  }

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
  }

  private cleanupWatcher(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = null;
    }
  }
}
