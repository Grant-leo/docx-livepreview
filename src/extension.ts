/**
 * extension.ts — Entry point for word-chat-livepreview VSCode extension.
 *
 * Registers the CustomTextEditorProvider for .docx files and
 * pre-warms the Python + WPS COM renderer on activation.
 */
import * as vscode from "vscode";
import { DocxEditorProvider } from "./docxEditorProvider";
import { getPythonManager, PythonManager } from "./pythonManager";

let pythonManager: PythonManager | null = null;

export function activate(context: vscode.ExtensionContext) {
  // Windows + WPS requirement check — bail early on unsupported platforms
  if (process.platform !== "win32") {
    vscode.window.showWarningMessage(
      "DOCX Live Preview requires Windows with WPS Office installed."
    );
    return;
  }

  // Pre-warm Python + WPS COM in background so first open is fast
  pythonManager = getPythonManager(context.extensionPath);
  pythonManager.start().then(() => {
    return pythonManager!.ensureWarmedUp();
  }).catch((e) => {
    console.error("[DOCX] Failed to start Python renderer:", e);
  });

  // Register custom editor for .docx files
  const provider = new DocxEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "docx.docxPreview",
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("docx.goToPreview", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("No active editor.");
        return;
      }
      const line = editor.selection.active.line + 1; // 1-based
      provider.goToSourceLine(line);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("docx.openPreview", async (uri?: vscode.Uri) => {
      if (!uri) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          uri = editor.document.uri;
        }
      }
      if (uri && uri.fsPath.endsWith(".docx")) {
        await vscode.commands.executeCommand(
          "vscode.openWith",
          uri,
          "docx.docxPreview"
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("docx.refreshPreview", () => {
      vscode.commands.executeCommand("workbench.action.webview.reloadWebviewAction");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("docx.toggleAutoRefresh", () => {
      const config = vscode.workspace.getConfiguration("docx");
      const current = config.get<boolean>("autoRefresh", true);
      config.update("autoRefresh", !current, true);
      vscode.window.showInformationMessage(
        `Auto-refresh ${!current ? "enabled" : "disabled"}`
      );
    })
  );
}

export async function deactivate() {
  if (pythonManager) {
    await pythonManager.dispose();
  }
}
