/**
 * config.ts — Settings accessors for word-chat-livepreview.
 */
import * as vscode from "vscode";

const SECTION = "docx";

export function getPythonPath(): string {
  return vscode.workspace.getConfiguration(SECTION).get<string>("pythonPath", "python");
}

export function getAutoRefresh(): boolean {
  return vscode.workspace.getConfiguration(SECTION).get<boolean>("autoRefresh", true);
}

export function getDefaultZoom(): number {
  return vscode.workspace.getConfiguration(SECTION).get<number>("defaultZoom", 100);
}

export function getDefaultFit(): "width" | "page" | "none" {
  return vscode.workspace.getConfiguration(SECTION).get<"width" | "page" | "none">("defaultFit", "none");
}

export function getRenderDpi(): number {
  return vscode.workspace.getConfiguration(SECTION).get<number>("renderDpi", 200);
}
