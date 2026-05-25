/**
 * extension.ts — Entry point for word-chat-livepreview VSCode extension.
 *
 * Registers the CustomTextEditorProvider for .docx files.
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

  // Initialize the singleton; the renderer process is started lazily when needed.
  pythonManager = getPythonManager(context.extensionPath);

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
    vscode.commands.registerCommand("docx.goToPreview", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("No active editor.");
        return;
      }
      await provider.goToPreviewFromEditor(editor);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("docx.goToSource", () => {
      provider.goToSource();
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

  setTimeout(() => {
    const hasDocxTab = hasOpenDocxTab();
    if (hasDocxTab) {
      warmUpRenderer();
    }
    reopenOpenDocxTabsWithPreview().catch((e) => {
      console.error("[DOCX] Failed to restore DOCX preview tabs:", e);
    });
  }, 800);
}

function warmUpRenderer(): void {
  if (!pythonManager) { return; }
  pythonManager.start().then(() => {
    return pythonManager!.ensureWarmedUp();
  }).catch((e) => {
    console.error("[DOCX] Failed to start Python renderer:", e);
  });
}

function hasOpenDocxTab(): boolean {
  return vscode.window.tabGroups.all.some((group) =>
    group.tabs.some((tab) => {
      const uri = getTabInputUri(tab.input);
      return uri ? isDocxUri(uri) : false;
    })
  );
}

async function reopenOpenDocxTabsWithPreview(): Promise<void> {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (isDocxPreviewTab(tab.input)) { continue; }
      const uri = getTabInputUri(tab.input);
      if (!uri || !isDocxUri(uri)) { continue; }
      await vscode.commands.executeCommand(
        "vscode.openWith",
        uri,
        "docx.docxPreview",
        {
          preview: false,
          preserveFocus: !tab.isActive,
          viewColumn: group.viewColumn,
        }
      );
    }
  }
}

function getTabInputUri(input: unknown): vscode.Uri | undefined {
  const maybeInput = input as { uri?: vscode.Uri };
  return maybeInput.uri instanceof vscode.Uri ? maybeInput.uri : undefined;
}

function isDocxPreviewTab(input: unknown): boolean {
  return input instanceof vscode.TabInputCustom && input.viewType === "docx.docxPreview";
}

function isDocxUri(uri: vscode.Uri): boolean {
  const basename = uri.fsPath.split(/[\\/]/).pop() || "";
  return uri.scheme === "file" &&
    basename.toLowerCase().endsWith(".docx") &&
    !basename.startsWith("~$");
}

export async function deactivate() {
  if (pythonManager) {
    await pythonManager.dispose();
  }
}
