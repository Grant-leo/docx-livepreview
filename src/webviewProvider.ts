/**
 * webviewProvider.ts — Assembles the HTML content for the DOCX preview webview.
 *
 * Uses a Content Security Policy with nonce-based script/style loading.
 * The webview displays a single page image at a time with a minimal toolbar.
 */
import * as vscode from "vscode";

export function getHtmlForWebview(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const nonce = generateNonce();

  const stylesUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "styles.css")
  );
  const viewerUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "viewer.js")
  );

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 img-src data: ${webview.cspSource} https:;
                 style-src ${webview.cspSource} 'nonce-${nonce}';
                 script-src 'nonce-${nonce}';">
  <link nonce="${nonce}" rel="stylesheet" href="${stylesUri}">
</head>
<body>
  <div id="toolbar">
    <button id="btnPrev" title="Previous Page (Left Arrow)">&#9664;</button>
    <span id="pageInfo">Page <span id="currentPage">-</span> of <span id="totalPages">-</span></span>
    <button id="btnNext" title="Next Page (Right Arrow)">&#9654;</button>
    <div class="separator"></div>
    <button id="btnZoomOut" title="Zoom Out">&#8722;</button>
    <input type="range" id="zoomSlider" min="25" max="500" value="100" title="Zoom">
    <button id="btnZoomIn" title="Zoom In">+</button>
    <input type="number" id="zoomInput" min="25" max="500" value="100" title="Custom Zoom" style="width:52px;text-align:center">
    <span id="zoomLabel">100%</span>
    <button id="btnZoom100" title="100%">1:1</button>
<div class="separator"></div>
    <button id="btnRefresh" title="Refresh Preview">&#8635;</button>
  </div>

  <div id="pageContainer">
    <div id="loading">
      <div class="spinner"></div>
      <p>Loading document...</p>
    </div>
    <div id="error" class="hidden">
      <p id="errorMessage"></p>
      <button id="btnRetry">Retry</button>
    </div>
    <div id="canvasArea">
      <img id="pageImage" src="" alt="DOCX Page">
    </div>
  </div>

  <script nonce="${nonce}" src="${viewerUri}"></script>
</body>
</html>`;
}

function generateNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 64; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
