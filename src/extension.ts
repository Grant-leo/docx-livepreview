/**
 * extension.ts — Entry point for word-chat-livepreview VSCode extension.
 *
 * Registers the CustomTextEditorProvider for .docx files.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import { DocxEditorProvider } from "./docxEditorProvider";
import { PythonManager } from "./pythonManager";

let provider: DocxEditorProvider | null = null;
const MAX_LABEL_RECOVERY_SCAN = 1000;

export function activate(context: vscode.ExtensionContext) {
  // Windows + WPS requirement check — bail early on unsupported platforms
  if (process.platform !== "win32") {
    vscode.window.showWarningMessage(
      "DOCX Live Preview requires Windows with WPS Office installed."
    );
    return;
  }

  // Register custom editor for .docx files
  const docxProvider = new DocxEditorProvider(context);
  provider = docxProvider;
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "docx.docxPreview",
      docxProvider,
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
      await docxProvider.goToPreviewFromEditor(editor);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("docx.goToSource", () => {
      docxProvider.goToSource();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("docx.openPreview", async (uri?: vscode.Uri) => {
      if (!uri || !isDocxUri(uri)) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          uri = editor.document.uri;
        }
      }
      if (!uri || !isDocxUri(uri)) {
        uri = await getActiveTabDocxUri();
      }
      if (!uri || !isDocxUri(uri)) {
        uri = await findMostRecentWorkspaceDocx();
      }
      if (uri && isDocxUri(uri)) {
        await vscode.commands.executeCommand(
          "vscode.openWith",
          uri,
          "docx.docxPreview",
          { preview: false }
        );
      } else {
        vscode.window.setStatusBarMessage("DOCX: No DOCX file found to preview.", 3500);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("docx.refreshPreview", async () => {
      await docxProvider.refreshActivePreview();
    })
  );

  setTimeout(() => {
    reopenOpenDocxTabsWithPreview().catch((e) => {
      console.error("[DOCX] Failed to restore DOCX preview tabs:", e);
    });
  }, 800);
}

async function reopenOpenDocxTabsWithPreview(): Promise<void> {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (isDocxPreviewTab(tab.input)) { continue; }
      const uri = getTabInputUri(tab.input) || await findWorkspaceDocxByLabel(tab.label);
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
  if (!input || typeof input !== "object") { return undefined; }
  const maybeInput = input as {
    uri?: vscode.Uri;
    modified?: vscode.Uri;
    original?: vscode.Uri;
  };
  if (maybeInput.uri instanceof vscode.Uri) { return maybeInput.uri; }
  if (maybeInput.modified instanceof vscode.Uri) { return maybeInput.modified; }
  if (maybeInput.original instanceof vscode.Uri) { return maybeInput.original; }
  return undefined;
}

async function getActiveTabDocxUri(): Promise<vscode.Uri | undefined> {
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (!activeTab) { return undefined; }
  const uri = getTabInputUri(activeTab.input);
  if (uri && isDocxUri(uri)) { return uri; }
  return findWorkspaceDocxByLabel(activeTab.label);
}

function isDocxPreviewTab(input: unknown): boolean {
  return input instanceof vscode.TabInputCustom && input.viewType === "docx.docxPreview";
}

function isDocxUri(uri: vscode.Uri): boolean {
  const basename = uri.fsPath.split(/[\\/]/).pop() || "";
  return uri.scheme === "file" && isPreviewableDocxFilename(basename);
}

function isPreviewableDocxFilename(filename: string): boolean {
  return filename.toLowerCase().endsWith(".docx") && !filename.startsWith("~$");
}

async function findMostRecentWorkspaceDocx(): Promise<vscode.Uri | undefined> {
  const matches = await vscode.workspace.findFiles("**/*.docx", "**/~$*.docx", 20);
  return matches
    .filter(isDocxUri)
    .map((uri) => {
      try {
        return { uri, mtimeMs: fs.statSync(uri.fsPath).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is { uri: vscode.Uri; mtimeMs: number } => entry !== null)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.uri;
}

async function findWorkspaceDocxByLabel(label: string): Promise<vscode.Uri | undefined> {
  if (!isPreviewableDocxFilename(label)) { return undefined; }
  const directMatches: vscode.Uri[] = [];
  for (const folder of vscode.workspace.workspaceFolders || []) {
    const direct = vscode.Uri.joinPath(folder.uri, label);
    if (await isExistingFile(direct) && isDocxUri(direct)) {
      directMatches.push(direct);
    }
  }
  if (directMatches.length === 1) { return directMatches[0]; }
  if (directMatches.length > 1) { return undefined; }

  const allDocx = await vscode.workspace.findFiles(
    "**/*.docx",
    "**/~$*.docx",
    MAX_LABEL_RECOVERY_SCAN
  );
  if (allDocx.length >= MAX_LABEL_RECOVERY_SCAN) {
    return undefined;
  }

  const matches = allDocx
    .filter((uri) => isDocxUri(uri) && hasBasename(uri, label));
  return matches.length === 1 ? matches[0] : undefined;
}

function hasBasename(uri: vscode.Uri, basename: string): boolean {
  const actual = uri.fsPath.split(/[\\/]/).pop() || "";
  return actual.toLowerCase() === basename.toLowerCase();
}

async function isExistingFile(uri: vscode.Uri): Promise<boolean> {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    return stat.type === vscode.FileType.File;
  } catch {
    return false;
  }
}

export async function deactivate() {
  if (provider) {
    await provider.dispose();
    provider = null;
  }
  PythonManager.disposeSharedOutputChannel();
}
