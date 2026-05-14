# DOCX Live Preview

WPS-native DOCX preview for VSCode. Renders academic papers with **OMML math equations**, **CJK fonts**, and **three-line tables** pixel-perfect via the WPS COM engine.

## Prerequisites

- Windows (COM automation requires Windows)
- [WPS Office](https://www.wps.com/) installed
- Python 3.8+ with `pywin32` and `PyMuPDF`:
  ```bash
  pip install pywin32 PyMuPDF
  ```

## Usage

1. Open any `.docx` file in VSCode
2. The preview opens automatically with the WPS DOCX Preview editor
3. Or right-click a `.docx` file → **Open With...** → **WPS DOCX Preview**

### Controls

| Action | Shortcut / Button |
|---|---|
| Prev / Next page | ← → arrow keys |
| Zoom in / out | Toolbar buttons or <kbd>Ctrl</kbd> + scroll |
| Fit to width | ↔ button in toolbar |
| Refresh | ⟳ button or `Ctrl+Shift+P` → Refresh Preview |
| Toggle auto-refresh | `Ctrl+Shift+P` → Toggle Auto-Refresh |

## Configuration

| Setting | Default | Description |
|---|---|---|
| `docx.defaultZoom` | `100` | Default zoom percentage (10-500) |
| `docx.defaultFit` | `none` | Default fit mode: `none`, `width`, or `page` |
| `docx.renderDpi` | `200` | Render DPI — higher is sharper but slower |
| `docx.autoRefresh` | `true` | Auto-refresh preview when file changes |
| `docx.pythonPath` | `python` | Path to Python 3.8+ executable |

## How It Works

WPS Office COM → ExportAsFixedFormat (PDF) → PyMuPDF renders to PNG → webview displays page-by-page. Low-res preview appears in ~50ms, high-res follows immediately.

## License

MIT
